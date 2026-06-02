const db = require('../config/database');

(async function(){
  try{
    const cols = await db.executeQuery("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Employee'");
    console.log('Employee columns:', cols);
    process.exit(0);
  }catch(err){
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
