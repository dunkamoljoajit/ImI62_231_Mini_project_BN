const express = require('express');
const app = express();
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs'); // For hashing passwords
const fs = require('fs');
const path = require('path');
const hostname = '127.0.0.1';
const port = 3000;

let cer_part = path.join(process.cwd(), 'isrgrootx1.pem');


const connection = mysql.createConnection({
    host: 'gateway01.us-west-2.prod.aws.tidbcloud.com',
    user: '2qYTxNqutH4o3YW.root',
    password: "s2Y4c1ZxTjIwgZmg",
    database: 'elderly_health_db',
    ssl: {
        ca: fs.readFileSync(cer_part)
    }
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting: ' + err.stack);
        return;
    }
    console.log('Connected as id ' + connection.threadId);
    // Set the timezone after the connection is established
    connection.query("SET time_zone = 'Asia/Bangkok'", (err, results) => {
        if (err) {
            console.error('Error setting timezone: ' + err.stack);
        } else {
            console.log('Timezone set to Asia/Bangkok');
        }
    });
});


app.use(cors());
app.use(express.json());

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});

var urlencodedParser = bodyParser.urlencoded({ extended: false });

// Root route to provide metadata about the API
app.get('/', (req, res) => {
    res.json({
        "Name": "Elder Health Monitoring System",
        "Author": "Dungkamol Joajit, Siriuma Pimsen",
        "APIs": [
            { "api_name": "/api/register", "method": "POST" },
            { "api_name": "/api/health", "method": "POST" },
            { "api_name": "/api/health/:elderly_id", "method": "PUT" },
            { "api_name": "/api/health/:elderly_id", "method": "DELETE" },
            { "api_name": "/api/health/:elderly_id", "method": "GET" },
            { "api_name": "/api/health/", "method": "GET" }
        ]
    });
});


// Register a new user (caregiver or elderly)
app.post('/api/register', urlencodedParser, async (req, res) => {
    const { username, password, role, name, age, gender, caregiver_id } = req.body;

    // Check for missing fields
    if (!username || !password || !role || 
        (role === 'elderly' && (!name || !age || !gender || !caregiver_id))) {
        return res.status(400).json({ message: "Missing required fields" });
    }
    
    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Register caregiver or elderly
        if (role === 'caregiver') {
            // Insert caregiver into the database
            const query = `INSERT INTO caregiver (username, password, role, name) VALUES (?, ?, ?, ?)`;
            connection.execute(query, [username, hashedPassword, role, name], (err, results) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ message: "Error registering caregiver" });
                }
                res.status(201).json({ message: "Caregiver registered successfully" });
            });
        } else if (role === 'elderly') {
            // Ensure caregiver_id is provided
            if (!caregiver_id) {
                return res.status(400).json({ message: "Caregiver ID is required for elderly" });
            }

            // Insert elderly into the database
            const query = `INSERT INTO elderly (username, password, name, age, gender, role, caregiver_id) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            connection.execute(query, [username, hashedPassword, name, age, gender, role, caregiver_id], (err, results) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ message: `Error registering elderly: ${err.message}` });
                }
                res.status(201).json({ message: "Elderly registered successfully"});
            });
        }
    } catch (err) {
        console.error('Error hashing password:', err);
        res.status(500).json({ message: "Error hashing password" });
    }
});



// Submit health data for an elderly
app.post('/api/health', urlencodedParser, (req, res) => {
    const { elderly_id, heart_rate, blood_pressure, temperature } = req.body;

    if (!elderly_id || !heart_rate || !blood_pressure || !temperature) {
        return res.status(400).json({ message: "All fields are required" });
    }

    const query = `INSERT INTO health_data (elderly_id, heart_rate, blood_pressure, temperature) VALUES (?, ?, ?, ?)`;
    connection.execute(query, [elderly_id, heart_rate, blood_pressure, temperature], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Error submitting health data" });
        }
        res.status(201).json({ message: "Health data submitted successfully" });
    });
});

// Update health data for an elderly
app.put('/api/health/:elderly_id', urlencodedParser, (req, res) => {
    const elderly_id = req.params.elderly_id;
    const { heart_rate, blood_pressure, temperature } = req.body;

    if (!heart_rate || !blood_pressure || !temperature) {
        return res.status(400).json({ message: "All fields are required" });
    }

    const query = `UPDATE health_data SET heart_rate = ?, blood_pressure = ?, temperature = ? WHERE elderly_id = ?`;
    connection.execute(query, [heart_rate, blood_pressure, temperature, elderly_id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Error updating health data" });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Elderly not found" });
        }
        res.status(200).json({ message: "Health data updated successfully" });
    });
});

// Delete health data for an elderly
app.delete('/api/health/:elderly_id', (req, res) => {
    const elderly_id = req.params.elderly_id;

    const query = `DELETE FROM health_data WHERE elderly_id = ?`;
    connection.execute(query, [elderly_id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Error deleting health data" });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: "Elderly not found" });
        }
        res.status(200).json({ message: "Health data deleted successfully" });
    });
});

// Get health data for a specific elderly
app.get('/api/health/:elderly_id', (req, res) => {
  const elderly_id = req.params.elderly_id;

  const query = `SELECT * FROM health_data WHERE elderly_id = ?`;
  connection.execute(query, [elderly_id], (err, results) => {
      if (err) {
          console.error(err);
          return res.status(500).json({ message: "Error retrieving health data" });
      }
      if (results.length === 0) {
          return res.status(404).json({ message: "Health data not found for this elderly" });
      }
      res.status(200).json({ health_data: results });
  });
});
// Get health data
app.get('/api/healths/', (req, res) => {
    const query = 'SELECT * FROM health_data';
    
    connection.execute(query, (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ message: `Error retrieving health data: ${err.message}` });
        }
        res.status(200).json(results);
    });
});
app.get('/api/caregivers', (req, res) => {
    const query = 'SELECT * FROM caregiver';

    connection.execute(query, (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ message: `Error retrieving caregivers: ${err.message}` });
        }
        res.status(200).json(results);
    });
});

app.get('/api/elderlys', (req, res) => {
    const query = 'SELECT * FROM elderly';

    connection.execute(query, (err, results) => {
        if (err) {
            console.error("Database Error:", err);
            return res.status(500).json({ message: `Error retrieving elderly: ${err.message}` });
        }
        res.status(200).json(results);
    });
});






