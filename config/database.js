const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_NAME,
  authentication: {
    type: 'default'
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableKeepAlive: true,
    instancename: process.env.DB_INSTANCE
  }
};

let pool;

async function getConnection() {
  try {
    if (!pool) {
      pool = new sql.ConnectionPool(config);
      await pool.connect();
      console.log('✓ Kết nối SQL Server thành công');
    }
    return pool;
  } catch (error) {
    console.error('✗ Lỗi kết nối SQL Server:', error.message);
    throw error;
  }
}

async function executeQuery(query, params = {}) {
  try {
    const connection = await getConnection();
    const request = connection.request();
    
    Object.keys(params).forEach(key => {
      request.input(key, params[key]);
    });
    
    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error('Lỗi thực thi query:', error.message);
    throw error;
  }
}

async function executeTransaction(callback) {
  const connection = await getConnection();
  const transaction = new sql.Transaction(connection);
  try {
    await transaction.begin();
    const request = new sql.Request(transaction);
    const result = await callback(request);
    await transaction.commit();
    return result;
  } catch (error) {
    try { await transaction.rollback(); } catch (_) {}
    throw error;
  }
}

module.exports = {
  getConnection,
  executeQuery,
  executeTransaction,
  sql
};
