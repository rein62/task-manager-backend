const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Подключение к базе данных с SSL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false, // Обязательно для Supabase и Neon
    require: true
  },
  // Увеличиваем таймауты для облачного подключения
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

// Middleware с настройкой CORS
app.use(cors({
  origin: ['http://localhost:3000', 'https://your-frontend.vercel.app'], // Замени на свой домен Vercel
  credentials: true
}));
app.use(express.json());

// Простые эндпоинты для проверки
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'task-manager-backend'
  });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as time, version() as version');
    res.json({ 
      success: true, 
      message: 'Database connected successfully!',
      time: result.rows[0].time,
      version: result.rows[0].version,
      connection: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        database: process.env.DB_NAME
      }
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Check DB_HOST, DB_PORT, DB_PASSWORD and SSL settings'
    });
  }
});

// Проверка подключения к БД при запуске
pool.on('connect', () => {
  console.log('✅ PostgreSQL client connected');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err);
});

// Проверяем подключение при старте
(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Успешное подключение к PostgreSQL');
    
    // Проверяем существование таблиц
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log(`📊 Найдено таблиц: ${tablesResult.rows.length}`);
    
    if (tablesResult.rows.length === 0) {
      console.log('⚠️ Таблицы не найдены. Нужно создать через Supabase SQL Editor');
    }
    
    client.release();
  } catch (error) {
    console.error('❌ Ошибка подключения к БД:', error.message);
    console.log('Проверьте:');
    console.log('1. DB_HOST:', process.env.DB_HOST);
    console.log('2. DB_PORT:', process.env.DB_PORT);
    console.log('3. DB_USER:', process.env.DB_USER);
    console.log('4. DB_NAME:', process.env.DB_NAME);
    console.log('5. SSL должен быть включен для Supabase');
    
    if (error.message.includes('ENETUNREACH') || error.message.includes('IPv6')) {
      console.log('\n🚨 ПРОБЛЕМА IPv4/IPv6:');
      console.log('- Render использует IPv4, а Supabase - IPv6');
      console.log('- Решение 1: Используйте Connection Pooler (порт 6543)');
      console.log('- Решение 2: Создайте базу на Neon.tech (работает с IPv4)');
      console.log('- Решение 3: Купите IPv4 add-on в Supabase');
    }
  }
})();

// Вход в систему
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('Login attempt for user:', username);
    
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    const user = result.rows[0];
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({ 
      success: true, 
      user: userWithoutPassword 
    });
    
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

// Получить всех пользователей
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, name, role, created_at FROM users');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

// Добавить пользователя
app.post('/api/users', async (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    
    const result = await pool.query(
      'INSERT INTO users (username, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, name, role, created_at',
      [username, password, name, role]
    );
    
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Ошибка добавления пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

// Удалить пользователя
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

// Обновить роль пользователя
app.put('/api/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка обновления роли:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

// Получить всех исполнителей
app.get('/api/executors', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM executors ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения исполнителей:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

// Добавить исполнителя
app.post('/api/executors', async (req, res) => {
  try {
    const { name, specialization, rating } = req.body;
    
    const result = await pool.query(
      'INSERT INTO executors (name, specialization, rating) VALUES ($1, $2, $3) RETURNING *',
      [name, specialization, parseFloat(rating)]
    );
    
    res.json({ success: true, executor: result.rows[0] });
  } catch (error) {
    console.error('Ошибка добавления исполнителя:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

// Удалить исполнителя
app.delete('/api/executors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM executors WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления исполнителя:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

// Обновить статус исполнителя
app.put('/api/executors/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await pool.query('UPDATE executors SET status = $1 WHERE id = $2', [status, id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка обновления статуса:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

// Получить все задачи
app.get('/api/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения задач:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

// Добавить задачу
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, deadline, executor_id, executor_name, created_by } = req.body;
    
    const result = await pool.query(
      `INSERT INTO tasks (title, description, deadline, executor_id, executor_name, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, description, deadline, executor_id, executor_name, created_by]
    );
    
    await pool.query('UPDATE executors SET status = $1 WHERE id = $2', ['busy', executor_id]);
    
    res.json({ success: true, task: result.rows[0] });
  } catch (error) {
    console.error('Ошибка добавления задачи:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

// Удалить задачу
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const taskResult = await pool.query('SELECT executor_id, status FROM tasks WHERE id = $1', [id]);
    
    if (taskResult.rows.length > 0) {
      const task = taskResult.rows[0];
      if (task.status === 'in-progress') {
        await pool.query('UPDATE executors SET status = $1 WHERE id = $2', ['free', task.executor_id]);
      }
    }
    
    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления задачи:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

// Обновить статус задачи
app.put('/api/tasks/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const taskResult = await pool.query('SELECT executor_id FROM tasks WHERE id = $1', [id]);
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    
    const executorId = taskResult.rows[0].executor_id;
    
    await pool.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, id]);
    
    const executorStatus = status === 'in-progress' ? 'busy' : 'free';
    await pool.query('UPDATE executors SET status = $1 WHERE id = $2', [executorStatus, executorId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка обновления статуса:', error);
    res.status(500).json({ error: 'Ошибка сервера', details: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Запуск сервера
app.listen(port, () => {
  console.log(`🚀 Сервер запущен на порту ${port}`);
  console.log(`📊 База данных: ${process.env.DB_NAME || 'not set'}`);
  console.log(`🌐 URL: http://localhost:${port}`);
  console.log(`🔗 Health check: http://localhost:${port}/health`);
  console.log(`📈 DB test: http://localhost:${port}/api/test-db`);
});