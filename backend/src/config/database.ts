import { Sequelize } from 'sequelize';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/formation_dev';

// Parse DATABASE_URL to handle Heroku's postgres:// protocol
const databaseUrl = DATABASE_URL.replace(/^postgres:\/\//, 'postgresql://');

// Configure Sequelize with connection pooling and SSL for production
const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false, // Required for Heroku
    } : false,
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
});

// Test database connection
export async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection established successfully');
    return true;
  } catch (error) {
    console.error('✗ Unable to connect to database:', error);
    return false;
  }
}

// Sync all models with database
export async function syncDatabase(force = false) {
  try {
    await sequelize.sync({ force });
    console.log(`✓ Database synchronized (force: ${force})`);
    return true;
  } catch (error) {
    console.error('✗ Error synchronizing database:', error);
    return false;
  }
}

export default sequelize;
