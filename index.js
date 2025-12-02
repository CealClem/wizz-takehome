const express = require('express');
const bodyParser = require('body-parser');
const db = require('./models');

const app = express();

app.use(bodyParser.json());
app.use(express.static(`${__dirname}/static`));

app.get('/api/games', (req, res) => db.Game.findAll()
  .then(games => res.send(games))
  .catch((err) => {
    console.log('There was an error querying games', JSON.stringify(err));
    return res.send(err);
  }));

app.post('/api/games', (req, res) => {
  const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
  return db.Game.create({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
    .then(game => res.send(game))
    .catch((err) => {
      console.log('***There was an error creating a game', JSON.stringify(err));
      return res.status(400).send(err);
    });
});

app.delete('/api/games/:id', (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  return db.Game.findByPk(id)
    .then(game => game.destroy({ force: true }))
    .then(() => res.send({ id }))
    .catch((err) => {
      console.log('***Error deleting game', JSON.stringify(err));
      res.status(400).send(err);
    });
});

app.put('/api/games/:id', (req, res) => {
  // eslint-disable-next-line radix
  const id = parseInt(req.params.id);
  return db.Game.findByPk(id)
    .then((game) => {
      const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
      return game.update({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
        .then(() => res.send(game))
        .catch((err) => {
          console.log('***Error updating game', JSON.stringify(err));
          res.status(400).send(err);
        });
    });
});

app.post('/api/games/search', (req, res) => {
  // Extract search parameters from the request body
  const { name, platform } = req.body;
  
  // Build a filter object - this is how we construct database queries in Sequelize
  const where = {};
  
  // If a name was provided, add a filter for partial name matching
  // sequelize.Op.like allows us to search for partial matches (case-insensitive)
  if (name && name.trim() !== '') {
    const { Op } = require('sequelize');
    where.name = { [Op.like]: `%${name}%` };
  }
  
  // If a platform was provided and it's not empty, add an exact match filter
  if (platform && platform.trim() !== '') {
    where.platform = platform;
  }
  
  // Query the database with our filters
  return db.Game.findAll({ where })
    .then(games => res.send(games))
    .catch((err) => {
      console.log('There was an error searching games', JSON.stringify(err));
      return res.status(400).send(err);
    });
});

app.post('/api/games/populate', (req, res) => {
  const axios = require('axios');
  const iosUrl = 'https://wizz-technical-test-dev.s3.eu-west-3.amazonaws.com/ios.top100.json';
  const androidUrl = 'https://wizz-technical-test-dev.s3.eu-west-3.amazonaws.com/android.top100.json';

  const fetchWithRetry = async (url, attempts = 3, delayMs = 500) => {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        const resp = await axios.get(url, { timeout: 5000 });
        return resp.data;
      } catch (err) {
        lastErr = err;
        // exponential backoff
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
      }
    }
    throw lastErr;
  };

  // fully flatten nested arrays of objects
  const flattenArrays = (arr) => {
    if (!Array.isArray(arr)) return [];
    let result = [];
    for (let item of arr) {
      if (Array.isArray(item)) {
        result = result.concat(flattenArrays(item));
      } else if (typeof item === 'object' && item !== null) {
        result.push(item);
      }
    }
    return result;
  };

  const scoreFromItem = (item) => {
    const rating = item.rating || 0;
    const ratingCount = item.rating_count || 0;
    const r = parseFloat(rating) || 0;
    const rc = parseFloat(ratingCount) || 0;
    return r * rc;
  };

  const normalizeItems = (raw, platformLabel) => {
    const mapped = flattenArrays(raw).map((item) => {
      const storeId = item.app_id || '';
      const name = item.humanized_name || '';
      const publisherId = String(item.publisher_id || '');
      const bundleId = item.bundle_id || '';
      const appVersion = item.version || '';
      const isPublished = typeof item.isPublished === 'boolean' ? item.isPublished : true;
      const score = scoreFromItem(item);
      return {
        db: { publisherId, name, platform: platformLabel, storeId: String(storeId), bundleId, appVersion, isPublished },
        score,
      };
    }).filter(x => x.db.storeId && x.db.storeId.trim() !== '');
    return mapped;
  };

  return Promise.allSettled([fetchWithRetry(iosUrl), fetchWithRetry(androidUrl)])
    .then(async (results) => {
      const successes = [];
      const warnings = [];

      if (results[0].status === 'fulfilled') {
        successes.push({ platform: 'ios', data: results[0].value });
      } else {
        warnings.push({ platform: 'ios', error: String(results[0].reason) });
      }

      if (results[1].status === 'fulfilled') {
        successes.push({ platform: 'android', data: results[1].value });
      } else {
        warnings.push({ platform: 'android', error: String(results[1].reason) });
      }

      if (successes.length === 0) {
        return res.status(502).send({ message: 'Failed to fetch both iOS and Android data', warnings });
      }

      // Normalize all items from all platforms into one combined list
      let allNormalized = [];
      for (const s of successes) {
        allNormalized = allNormalized.concat(normalizeItems(s.data, s.platform));
      }

      // Sort by score descending and pick top 100 overall (regardless of platform)
      const top100 = allNormalized
        .sort((a, b) => b.score - a.score)
        .slice(0, 100);

      // Fetch existing storeId+platform to avoid duplicates
      const existing = await db.Game.findAll({ attributes: ['storeId', 'platform'] });
      const existingSet = new Set(existing.map(g => `${g.storeId}|${g.platform}`));

      // Build final insert list (db objects only), skipping duplicates
      let toInsert = [];
      for (const item of top100) {
        const key = `${item.db.storeId}|${item.db.platform}`;
        if (!existingSet.has(key)) {
          toInsert.push(item.db);
          existingSet.add(key);
        }
      }

      // Insert into DB
      const created = [];
      for (const g of toInsert) {
        try {
          // create each record; avoid failing entire batch on single error
          // eslint-disable-next-line no-await-in-loop
          const c = await db.Game.create(g);
          created.push(c);
        } catch (err) {
          console.log('Warning: failed to create game', g.storeId, g.platform, String(err));
        }
      }

      return res.send({
        message: 'Population complete',
        created: created.length,
        skipped: top100.length - created.length,
        warnings,
      });
    })
    .catch((err) => {
      console.log('***Error populating games', String(err));
      res.status(500).send({ error: String(err) });
    });
});


app.listen(3000, () => {
  console.log('Server is up on port 3000');
});

module.exports = app;
