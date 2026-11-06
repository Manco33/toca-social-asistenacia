const { saveFinalHours } = require('../src/app/actions');

async function testSaveFinalHours() {
    try {
        // Test with sample data
        const userId = '1'; // Replace with a valid user ID from your database
        const totalHours = '8:00';
        const overtimeHours = '0:00';
        
        console.log('Testing saveFinalHours with:', { userId, totalHours, overtimeHours });
        await saveFinalHours(userId, totalHours, overtimeHours);
        console.log('Successfully saved final hours');
    } catch (error) {
        console.error('Error testing saveFinalHours:', error);
    }
}

testSaveFinalHours();