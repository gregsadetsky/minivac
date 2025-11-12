/**
 * Three-Floor Elevator
 *
 * Floor positions:
 * - Floor 1: D0-D1 (Light 1 ON)
 * - Floor 2: D6-D7 (Light 2 ON)
 * - Floor 3: D12-D13 (Light 3 ON)
 *
 * Controls:
 * - Button 1: Call to floor 1
 * - Button 2: Call to floor 2
 * - Button 3: Call to floor 3
 * - Buttons interlock during motion
 */

export const elevatorCircuit = {
  name: 'Three-Floor Elevator',
  description: 'Use buttons 1-3 to call elevator to different floors',
  circuit: [
    '1A/1E', '2B/2-', '3F/3G', '5F/6C', '1B/1-', '2C/3C', '3G/3X', '5G/5N',
    '1C/2C', '2E/D7', '3J/4E', '5J/5K', '1E/D1', '2F/2G', '3Y/4J', '5J/D17',
    '1F/1G', '2G/2X', '4C/5F', '5L/5-', '1G/1X', '2J/3H', '4F/4+', '5N/D18',
    '1H/1+', '2X/6H', '4G/5H', '6C/6-', '1H/1L', '2Y/3Y', '4H/4+', '6F/D12',
    '1J/2H', '3A/3E', '4L/D19', 'D0/D1', '1K/5E', '3B/3-', '4N/D18', 'D6/D7',
    '1Y/2Y', '3C/4C', '5C/5G', 'D12/D13', '2A/2E', '3E/D13', '5E/6G', 'D16/M+',
  ],
};
