const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Подключение к базе данных БЕЗ SSL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  family: 4,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 60000,
  max: 10
});

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.get('/health-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'OK', time: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
});

// Вход в систему
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
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
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить всех пользователей
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, name, role, created_at FROM users');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
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
    res.status(500).json({ error: 'Ошибка сервера' });
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
    res.status(500).json({ error: 'Ошибка сервера' });
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
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить всех исполнителей
app.get('/api/executors', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM executors ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения исполнителей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
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
    res.status(500).json({ error: 'Ошибка сервера' });
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
    res.status(500).json({ error: 'Ошибка сервера' });
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
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить все задачи
app.get('/api/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения задач:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
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
    res.status(500).json({ error: 'Ошибка сервера' });
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
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновить статус задачи (ИСПРАВЛЕННЫЙ КОД)
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
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Запуск сервера (ИСПРАВЛЕННЫЙ КОД)
app.listen(port, () => {
  console.log(`✔ Сервер запущен на порту ${port}`);
  console.log(`■ База данных: ${process.env.DB_NAME}`);
});  