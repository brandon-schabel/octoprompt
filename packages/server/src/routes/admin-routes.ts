/**
 * Admin Routes
 * This file contains API routes for administrative functions such as:
 * - Environment information retrieval
 * - System diagnostics
 * - Logging configuration
 * - Other admin-related operations
 * 
 * Most recent changes:
 * - Added environment info endpoint that provides filtered env variables and server info
 * - Added Bun version information to environment info
 * - Added database statistics showing count of entries in each table
 */

import app from '@/server-router';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '@/utils/database';

// Admin endpoint to get environment information
app.get('/api/admin/env-info', async (c) => {
    try {
        // Filter only needed environment variables for security
        const envInfo = {
            NODE_ENV: process.env.NODE_ENV,
            BUN_ENV: process.env.BUN_ENV,
            SERVER_PORT: process.env.PORT,
            // Add other safe-to-expose environment variables here
            // Don't include secrets or sensitive information
        };
        
        // Get database statistics
        const dbStats = {
            chats: db.query('SELECT COUNT(*) as count FROM chats').get() as { count: number },
            chat_messages: db.query('SELECT COUNT(*) as count FROM chat_messages').get() as { count: number },
            projects: db.query('SELECT COUNT(*) as count FROM projects').get() as { count: number },
            files: db.query('SELECT COUNT(*) as count FROM files').get() as { count: number },
            prompts: db.query('SELECT COUNT(*) as count FROM prompts').get() as { count: number },
            prompt_projects: db.query('SELECT COUNT(*) as count FROM prompt_projects').get() as { count: number },
            provider_keys: db.query('SELECT COUNT(*) as count FROM provider_keys').get() as { count: number },
            tickets: db.query('SELECT COUNT(*) as count FROM tickets').get() as { count: number },
            ticket_files: db.query('SELECT COUNT(*) as count FROM ticket_files').get() as { count: number },
            ticket_tasks: db.query('SELECT COUNT(*) as count FROM ticket_tasks').get() as { count: number },
            file_changes: db.query('SELECT COUNT(*) as count FROM file_changes').get() as { count: number },
        };

        return c.json({
            success: true,
            environment: envInfo,
            serverInfo: {
                version: process.version, // Node.js version
                bunVersion: Bun.version,  // Bun version
                platform: process.platform,
                arch: process.arch,
                memoryUsage: process.memoryUsage(),
                uptime: process.uptime(),
                // Add additional server information as needed
            },
            databaseStats: dbStats
        });
    } catch (e) {
        console.error('Failed to get environment info:', e);
        return c.json({
            error: 'Failed to get environment info',
            errorMessage: e instanceof Error ? e.message : String(e)
        }, 500);
    }
});

// Admin endpoint to check system status
app.get('/api/admin/system-status', async (c) => {
    try {
        // Perform basic system checks
        // You can add database connectivity check, external service checks, etc.
        
        return c.json({
            success: true,
            status: 'operational',
            checks: {
                api: 'healthy',
                timestamp: new Date().toISOString()
            }
        });
    } catch (e) {
        console.error('Failed to get system status:', e);
        return c.json({
            error: 'Failed to get system status',
            errorMessage: e instanceof Error ? e.message : String(e)
        }, 500);
    }
}); 