const { Pool } = require('pg');
const config = require('./config.json').database;

const pool = new Pool ({
    user: config.user,
    host: config.host,
    database: config.name,
    password: config.password,
    port: config.port,
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};