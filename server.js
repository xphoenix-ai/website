const express = require('express');
const nodemailer = require('nodemailer');
const winston = require('winston');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static('.'));

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Configure logger
const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        })
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(logsDir, `email_${new Date().toISOString().split('T')[0]}.log`)
        })
    ]
});

// Configure email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify email configuration
transporter.verify((error, success) => {
    if (error) {
        logger.error('Email configuration error:', error);
    } else {
        logger.info('Server is ready to send emails');
    }
});

// Handle form submission
app.post('/send-email', async (req, res) => {
    try {
        logger.info('New form submission received');
        
        const { Name, Email, Phone, Message } = req.body;
        
        // Validate inputs
        if (!Name || !Email || !Phone || !Message) {
            throw new Error('Required fields are missing');
        }
        
        if (!Email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            throw new Error('Invalid email format');
        }
        
        logger.info(`Form data received - Name: ${Name}, Email: ${Email}, Phone: ${Phone}`);
        
        // Email options
        const mailOptions = {
            from: Email,
            to: process.env.RECIPIENT_EMAIL,
            subject: `New Contact Form Submission from ${Name}`,
            text: `
Name: ${Name}
Email: ${Email}
Phone: ${Phone}

Message:
${Message}
            `
        };
        
        logger.info(`Attempting to send email to: ${mailOptions.to}`);
        
        // Send email
        await transporter.sendMail(mailOptions);
        
        logger.info('Email sent successfully');
        res.json({
            status: 'success',
            message: 'Thank you! Your message has been sent.'
        });
        
    } catch (error) {
        logger.error(`Error in form submission: ${error.message}`);
        res.status(500).json({
            status: 'error',
            message: `Error: ${error.message}`
        });
    }
});

// Serve log viewer
app.get('/view-logs', (req, res) => {
    try {
        const logFiles = fs.readdirSync(logsDir)
            .filter(file => file.startsWith('email_'))
            .sort()
            .reverse();
            
        let html = `
        <html>
        <head>
            <title>Email Logs</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .log-entry { margin-bottom: 10px; }
                .ERROR { color: red; }
                .SUCCESS { color: green; }
                .INFO { color: gray; }
                .log-file { margin-bottom: 30px; }
                .log-date { font-size: 1.2em; font-weight: bold; margin: 20px 0 10px 0; }
            </style>
        </head>
        <body>
            <h1>Email Logs</h1>
        `;
        
        if (logFiles.length === 0) {
            html += '<p>No logs found.</p>';
        } else {
            logFiles.forEach(file => {
                const content = fs.readFileSync(path.join(logsDir, file), 'utf8');
                html += `
                    <div class="log-file">
                        <div class="log-date">${file}</div>
                        <div class="logs">
                `;
                
                content.split('\n').forEach(line => {
                    if (line.trim()) {
                        let className = 'INFO';
                        if (line.includes('[ERROR]')) className = 'ERROR';
                        if (line.includes('sent successfully')) className = 'SUCCESS';
                        
                        html += `<div class="log-entry ${className}">${line}</div>`;
                    }
                });
                
                html += '</div></div>';
            });
        }
        
        html += '</body></html>';
        res.send(html);
        
    } catch (error) {
        res.status(500).send('Error loading logs');
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    logger.info('Server started');
}); 