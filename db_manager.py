import sqlite3
import threading
from datetime import datetime
import os

class DBManager:
    def __init__(self, db_name="harmony_history.db"):
        self.db_name = db_name
        self.lock = threading.Lock()
        self._init_db()

    def _init_db(self):
        with self.lock:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    level TEXT NOT NULL,
                    chord_type TEXT NOT NULL,
                    is_correct BOOLEAN NOT NULL
                )
            ''')
            conn.commit()
            conn.close()

    def record_answer_async(self, level, chord_type, is_correct):
        """Asynchronously saves the answer and triggers UI update callback if provided."""
        def _save():
            with self.lock:
                conn = sqlite3.connect(self.db_name)
                cursor = conn.cursor()
                now_str = datetime.now().isoformat()
                cursor.execute('''
                    INSERT INTO sessions (timestamp, level, chord_type, is_correct)
                    VALUES (?, ?, ?, ?)
                ''', (now_str, level, chord_type, is_correct))
                
                # Rolling buffer: keep only last 500 records
                cursor.execute('SELECT COUNT(*) FROM sessions')
                count = cursor.fetchone()[0]
                if count > 500:
                    limit = count - 500
                    cursor.execute('DELETE FROM sessions WHERE id IN (SELECT id FROM sessions ORDER BY id ASC LIMIT ?)', (limit,))
                
                conn.commit()
                conn.close()
                pass
        
        threading.Thread(target=_save, daemon=True).start()

    def get_global_win_rate(self):
        """Returns (correct_count, total_count, win_rate_percentage) synchronously."""
        with self.lock:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) FROM sessions')
            total = cursor.fetchone()[0]
            
            if total == 0:
                conn.close()
                return 0, 0, 0.0
                
            cursor.execute('SELECT COUNT(*) FROM sessions WHERE is_correct = 1')
            correct = cursor.fetchone()[0]
            conn.close()
            
            win_rate = (correct / total) * 100
            return correct, total, win_rate

    def get_level_stats(self, level_name):
        """Returns a dict mapping chord_type -> (correct_count, total_count, win_rate)."""
        with self.lock:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT chord_type, 
                       SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct, 
                       COUNT(*) as total 
                FROM sessions 
                WHERE level = ? 
                GROUP BY chord_type
            ''', (level_name,))
            stats = {}
            for row in cursor.fetchall():
                chord, correct, total = row
                wr = (correct / total) * 100 if total > 0 else 0
                stats[chord] = (correct, total, wr)
            conn.close()
            return stats

    def clear_history_async(self, callback=None):
        """Asynchronously drops all history from sessions and invokes a safe ui_callback."""
        def _clear():
            with self.lock:
                conn = sqlite3.connect(self.db_name)
                cursor = conn.cursor()
                cursor.execute('DELETE FROM sessions')
                conn.commit()
                conn.close()
            if callback:
                callback()
        threading.Thread(target=_clear, daemon=True).start()
