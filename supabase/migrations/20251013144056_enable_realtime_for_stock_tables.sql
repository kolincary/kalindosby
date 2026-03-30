/*
  # Enable Realtime for Stock Tables
  
  1. Changes
    - Enable realtime publication for `stock_items` table
    - Enable realtime publication for `database_log` table
    
  2. Purpose
    - Allow real-time updates to be broadcast to frontend clients
    - Ensure stock data is always up-to-date without manual refresh
    - Enable automatic UI updates when stock changes occur
*/

-- Enable realtime for stock_items table
ALTER PUBLICATION supabase_realtime ADD TABLE stock_items;

-- Enable realtime for database_log table
ALTER PUBLICATION supabase_realtime ADD TABLE database_log;
