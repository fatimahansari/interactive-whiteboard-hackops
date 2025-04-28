const Pool = require('pg').Pool;

const pool = new Pool({
	host: "db.icohfhiauxridvipkynv.supabase.co",
	user: "postgres",
	port: 5432,
	database: "postgres",
	password: "nPBWjD7TrrC9RpZA"
});

module.exports = pool;