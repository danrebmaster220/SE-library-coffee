const db = require('../config/db');

async function migrate() {
    try {
        console.log('Starting migration for library_sessions table...');
        
        // 1. Make seat_id nullable
        console.log('Modifying seat_id column to be NULLable...');
        await db.query('ALTER TABLE library_sessions MODIFY seat_id INT(11) NULL');
        
        // 2. Drop existing foreign key
        console.log('Dropping old foreign key constraint...');
        try {
            await db.query('ALTER TABLE library_sessions DROP FOREIGN KEY library_sessions_ibfk_1');
        } catch (e) {
            console.log('Foreign key might not exist or has a different name, ignoring drop error: ' + e.message);
        }
        
        // 3. Add new foreign key with ON DELETE SET NULL
        console.log('Adding new foreign key with ON DELETE SET NULL...');
        await db.query('ALTER TABLE library_sessions ADD CONSTRAINT library_sessions_ibfk_1 FOREIGN KEY (seat_id) REFERENCES library_seats(seat_id) ON DELETE SET NULL');
        
        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
