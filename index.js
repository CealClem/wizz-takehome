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

  // Step 1: Clear existing games from the database
  return db.Game.destroy({ truncate: true })
    .then(() => {
      // Step 2: Fetch both files from S3
      return Promise.all([
        axios.get(iosUrl),
        axios.get(androidUrl),
      ]);
    })
    .then(([iosResponse, androidResponse]) => {
      // The files are deeply nested arrays — flatten them completely
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

      const mapToModel = (item) => ({
        publisherId: item.publisher_id ? String(item.publisher_id) : (item.publisherId ? String(item.publisherId) : ''),
        name: item.name || item.humanized_name || '',
        platform: item.os || item.platform || '',
        storeId: item.id || item.app_id || item.appId || '',
        bundleId: item.appId || item.bundleId || item.app_id || item.id || '',
        appVersion: item.appVersion || item.version || '',
        isPublished: typeof item.isPublished === 'boolean' ? item.isPublished : true,
      });

      // Flatten both S3 responses
      const iosNormalized = flattenArrays(iosResponse.data);
      const androidNormalized = flattenArrays(androidResponse.data);

      // Map to model shape
      const iosGames = iosNormalized.map(mapToModel);
      const androidGames = androidNormalized.map(mapToModel);

      const topGames = [...iosGames, ...androidGames]
        .sort((a, b) => 
          ((b.rating || 0) * (b.ratingCount || 0)) - 
          ((a.rating || 0) * (a.ratingCount || 0))
        )
        .slice(0, 100);

      // Prevent duplicates: only insert games where storeId+platform doesn't already exist
      return db.Game.findAll({ attributes: ['storeId', 'platform'] })
        .then((existing) => {
          const existingSet = new Set(existing.map(g => `${g.storeId}|${g.platform}`));
          const toInsert = topGames.filter(g => g.storeId && g.storeId.toString().trim() !== '' && !existingSet.has(`${g.storeId}|${g.platform}`));
          return Promise.all(toInsert.map(g => db.Game.create(g))).then(created => ({ created: created.length, skipped: topGames.length - created.length }));
        });
    }).then((result) => {
      res.send({ message: `Population complete. Created: ${result.created}, Skipped (duplicates): ${result.skipped}` });
    })
    .catch((err) => {
      console.log('***Error populating games', JSON.stringify(err));
      res.status(400).send(err);
    });
});


app.listen(3000, () => {
  console.log('Server is up on port 3000');
});

module.exports = app;
