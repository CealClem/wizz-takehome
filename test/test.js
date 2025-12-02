const request = require('supertest');
var assert = require('assert');
const app = require('../index');

/**
 * Testing create game endpoint
 */
describe('POST /api/games', function () {
    let data = {
        publisherId: "1234567890",
        name: "Test App",
        platform: "ios",
        storeId: "1234",
        bundleId: "test.bundle.id",
        appVersion: "1.0.0",
        isPublished: true
    }
    it('respond with 200 and an object that matches what we created', function (done) {
        request(app)
            .post('/api/games')
            .send(data)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, result) => {
                if (err) return done(err);
                assert.strictEqual(result.body.publisherId, '1234567890');
                assert.strictEqual(result.body.name, 'Test App');
                assert.strictEqual(result.body.platform, 'ios');
                assert.strictEqual(result.body.storeId, '1234');
                assert.strictEqual(result.body.bundleId, 'test.bundle.id');
                assert.strictEqual(result.body.appVersion, '1.0.0');
                assert.strictEqual(result.body.isPublished, true);
                done();
            });
    });
});

/**
 * Testing get all games endpoint
 */
describe('GET /api/games', function () {
    it('respond with json containing a list that includes the game we just created', function (done) {
        request(app)
            .get('/api/games')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, result) => {
                if (err) return done(err);
                assert.strictEqual(result.body[0].publisherId, '1234567890');
                assert.strictEqual(result.body[0].name, 'Test App');
                assert.strictEqual(result.body[0].platform, 'ios');
                assert.strictEqual(result.body[0].storeId, '1234');
                assert.strictEqual(result.body[0].bundleId, 'test.bundle.id');
                assert.strictEqual(result.body[0].appVersion, '1.0.0');
                assert.strictEqual(result.body[0].isPublished, true);
                done();
            });
    });
});


/**
 * Testing update game endpoint
 */
describe('PUT /api/games/1', function () {
    let data = {
        id : 1,
        publisherId: "999000999",
        name: "Test App Updated",
        platform: "android",
        storeId: "5678",
        bundleId: "test.newBundle.id",
        appVersion: "1.0.1",
        isPublished: false
    }
    it('respond with 200 and an updated object', function (done) {
        request(app)
            .put('/api/games/1')
            .send(data)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, result) => {
                if (err) return done(err);
                assert.strictEqual(result.body.publisherId, '999000999');
                assert.strictEqual(result.body.name, 'Test App Updated');
                assert.strictEqual(result.body.platform, 'android');
                assert.strictEqual(result.body.storeId, '5678');
                assert.strictEqual(result.body.bundleId, 'test.newBundle.id');
                assert.strictEqual(result.body.appVersion, '1.0.1');
                assert.strictEqual(result.body.isPublished, false);
                done();
            });
    });
});

/**
 * Testing update game endpoint
 */
describe('DELETE /api/games/1', function () {
    it('respond with 200', function (done) {
        request(app)
            .delete('/api/games/1')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err) => {
                if (err) return done(err);
                done();
            });
    });
});

/**
 * Testing get all games endpoint
 */
describe('GET /api/games', function () {
    it('respond with json containing no games', function (done) {
        request(app)
            .get('/api/games')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, result) => {
                if (err) return done(err);
                assert.strictEqual(result.body.length, 0);
                done();
            });
    });
});

/**
 * Testing search games endpoint
 */
describe('POST /api/games/search', function () {
    // First create a test game to search for
    before(function (done) {
        const testData = {
            publisherId: "999",
            name: "SearchTest Game",
            platform: "ios",
            storeId: "9999",
            bundleId: "search.test.bundle",
            appVersion: "1.0.0",
            isPublished: true
        };
        request(app)
            .post('/api/games')
            .send(testData)
            .end((err) => {
                if (err) return done(err);
                done();
            });
    });

    it('should search by name and return matching games', function (done) {
        request(app)
            .post('/api/games/search')
            .send({ name: 'SearchTest', platform: '' })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, result) => {
                if (err) return done(err);
                assert(Array.isArray(result.body));
                assert(result.body.length > 0);
                assert.strictEqual(result.body[0].name, 'SearchTest Game');
                done();
            });
    });

    it('should search by platform and return matching games', function (done) {
        request(app)
            .post('/api/games/search')
            .send({ name: '', platform: 'ios' })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, result) => {
                if (err) return done(err);
                assert(Array.isArray(result.body));
                assert(result.body.length > 0);
                assert.strictEqual(result.body[0].platform, 'ios');
                done();
            });
    });

    it('should search by both name and platform', function (done) {
        request(app)
            .post('/api/games/search')
            .send({ name: 'SearchTest', platform: 'ios' })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, result) => {
                if (err) return done(err);
                assert(Array.isArray(result.body));
                assert(result.body.length > 0);
                assert.strictEqual(result.body[0].name, 'SearchTest Game');
                assert.strictEqual(result.body[0].platform, 'ios');
                done();
            });
    });

    it('should return all games when no filters provided', function (done) {
        request(app)
            .post('/api/games/search')
            .send({ name: '', platform: '' })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, result) => {
                if (err) return done(err);
                assert(Array.isArray(result.body));
                assert(result.body.length > 0);
                done();
            });
    });

    it('should return empty array for non-matching search', function (done) {
        request(app)
            .post('/api/games/search')
            .send({ name: 'NonExistentGame', platform: '' })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, result) => {
                if (err) return done(err);
                assert(Array.isArray(result.body));
                assert.strictEqual(result.body.length, 0);
                done();
            });
    });
});

/**
 * Testing populate games endpoint
 */
describe('POST /api/games/populate', function () {
    it('should populate games from S3 and return summary', function (done) {
        this.timeout(15000); // Allow 15 seconds for S3 fetch and DB inserts
        request(app)
            .post('/api/games/populate')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, result) => {
                if (err) return done(err);
                assert(result.body.message);
                assert.strictEqual(result.body.message, 'Population complete');
                assert(typeof result.body.created === 'number');
                assert(typeof result.body.skipped === 'number');
                assert(result.body.created > 0);
                done();
            });
    });

    it('should skip duplicates on second populate call', function (done) {
        this.timeout(15000);
        request(app)
            .post('/api/games/populate')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, result) => {
                if (err) return done(err);
                // Second call should create 0 new games (all are duplicates)
                assert.strictEqual(result.body.created, 0);
                // Skipped should be 100 (top 100 apps)
                assert.strictEqual(result.body.skipped, 100);
                done();
            });
    });
});
