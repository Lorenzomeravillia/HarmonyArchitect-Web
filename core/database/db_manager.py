"""
Database Manager esteso per HarmonyArchitect.
Implementa StorageInterface per architettura cross-platform.
Aggiunge supporto per spaced repetition, classificazione errori e analytics avanzate.
"""

import sqlite3
import threading
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Dict, Any, Callable
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple, Callable
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, asdict
import uuid

from shared.storage_interface import StorageInterface, PracticeRecord, ErrorCategory, PracticeMode, ExerciseMetadata
from core.models.exercise_model import SpacedRepetitionData

class EnhancedDBManager(StorageInterface):
    """Database Manager esteso con nuove funzionalità pedagogiche"""
    
    def __init__(self, db_name: str = "harmony_history.db"):
        self.db_name = db_name
        self.lock = threading.Lock()
        self._init_db()
    
    def _init_db(self):
        """Inizializza il database con nuove tabelle per funzionalità avanzate"""
        with self.lock:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            
            # Tabella originale (mantenuta per compatibilità)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    level TEXT NOT NULL,
                    chord_type TEXT NOT NULL,
                    is_correct BOOLEAN NOT NULL
                )
            ''')
            
            # Nuova tabella per record avanzati
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS practice_records (
                    record_id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    level TEXT NOT NULL,
                    exercise_id TEXT NOT NULL,
                    is_correct BOOLEAN NOT NULL,
                    response_time_ms INTEGER,
                    error_category TEXT,
                    user_confidence INTEGER,
                    session_id TEXT
                )
            ''')
            
            # Tabella per spaced repetition
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS spaced_repetition (
                    exercise_id TEXT PRIMARY KEY,
                    easiness_factor REAL NOT NULL,
                    interval_days INTEGER NOT NULL,
                    repetition_number INTEGER NOT NULL,
                    next_review_date TEXT NOT NULL,
                    last_review_date TEXT NOT NULL,
                    last_review_correct BOOLEAN NOT NULL,
                    last_confidence INTEGER NOT NULL
                )
            ''')
            
            # Tabella per sessioni
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS practice_sessions (
                    session_id TEXT PRIMARY KEY,
                    start_time TEXT NOT NULL,
                    end_time TEXT,
                    duration_minutes INTEGER NOT NULL,
                    level TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    exercises_attempted INTEGER NOT NULL,
                    exercises_correct INTEGER NOT NULL,
                    total_response_time_ms INTEGER NOT NULL
                )
            ''')
            
            # Indici per performance
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_level ON sessions(level)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_chord_type ON sessions(chord_type)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_practice_records_timestamp ON practice_records(timestamp)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_practice_records_exercise ON practice_records(exercise_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_spaced_repetition_next_review ON spaced_repetition(next_review_date)')
            
            conn.commit()
            conn.close()
    
    def record_practice(self, record: PracticeRecord) -> None:
        """Registra una pratica nel database (sincrono)"""
        with self.lock:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            
            # Inserisci nel nuovo formato
            cursor.execute('''
                INSERT INTO practice_records 
                (record_id, timestamp, level, exercise_id, is_correct, response_time_ms, error_category, user_confidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                record.record_id,
                record.timestamp,
                record.level,
                record.exercise_id,
                record.is_correct,
                record.response_time_ms,
                record.error_category.value if record.error_category else None,
                record.user_confidence
            ))
            
            # Mantieni compatibilità con tabella originale
            cursor.execute('''
                INSERT INTO sessions (timestamp, level, chord_type, is_correct)
                VALUES (?, ?, ?, ?)
            ''', (
                record.timestamp,
                record.level,
                record.exercise_id,
                record.is_correct
            ))
            
            # Rolling buffer: mantieni solo ultimi 500 record
            cursor.execute('SELECT COUNT(*) FROM sessions')
            count = cursor.fetchone()[0]
            if count > 500:
                limit = count - 500
                cursor.execute('DELETE FROM sessions WHERE id IN (SELECT id FROM sessions ORDER BY id ASC LIMIT ?)', (limit,))
            
            conn.commit()
            conn.close()
    
    def record_practice_async(self, record: PracticeRecord, 
                            callback: Optional[Callable[[], None]] = None) -> None:
        """Registra una pratica in modo asincrono"""
        def _save():
            self.record_practice(record)
            if callback:
                callback()
        
        threading.Thread(target=_save, daemon=True).start()
    
    def get_global_stats(self) -> Tuple[int, int, float]:
        """Restituisce statistiche globali"""
        with self.lock:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            
            # Usa la nuova tabella per statistiche più accurate
            cursor.execute('SELECT COUNT(*) FROM practice_records')
            total = cursor.fetchone()[0]
            
            if total == 0:
                # Fallback alla tabella originale
                cursor.execute('SELECT COUNT(*) FROM sessions')
                total = cursor.fetchone()[0]
                
                if total == 0:
                    conn.close()
                    return 0, 0, 0.0
                
                cursor.execute('SELECT COUNT(*) FROM sessions WHERE is_correct = 1')
                correct = cursor.fetchone()[0]
            else:
                cursor.execute('SELECT COUNT(*) FROM practice_records WHERE is_correct = 1')
                correct = cursor.fetchone()[0]
            
            conn.close()
            
            win_rate = (correct / total) * 100 if total > 0 else 0.0
            return correct, total, win_rate
    
    def get_level_stats(self, level_name: str) -> Dict[str, Tuple[int, int, float]]:
        """Restituisce statistiche per livello"""
        with self.lock:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT exercise_id, 
                       SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct, 
                       COUNT(*) as total 
                FROM practice_records 
                WHERE level = ? 
                GROUP BY exercise_id
            ''', (level_name,))
            
            stats = {}
            for row in cursor.fetchall():
                exercise_id, correct, total = row
                wr = (correct / total) * 100 if total > 0 else 0
                stats[exercise_id] = (correct, total, wr)
            
            conn.close()
            return stats
    
    def get_exercise_stats(self, exercise_id: str) -> Optional[Tuple[int, int, float]]:
        """Restituisce statistiche per un esercizio specifico"""
        with self.lock:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct, 
                       COUNT(*) as total 
                FROM practice_records 
                WHERE exercise_id = ?
            ''', (exercise_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if row and row[1] > 0:
                correct, total = row
                wr = (correct / total) * 100
                return correct, total, wr
            
            return None
    
    def get_recent_practices(self, limit: int = 50) -> List[PracticeRecord]:
        """Restituisce le pratiche più recenti"""
        with self.lock:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT record_id, timestamp, level, exercise_id, is_correct, 
                       response_time_ms, error_category, user_confidence
                FROM practice_records 
                ORDER BY timestamp DESC 
                LIMIT ?
            ''', (limit,))
            
            records = []
            for row in cursor.fetchall():
                record_id, timestamp, level, exercise_id, is_correct, response_time_ms, error_category_str, user_confidence = row
                
                error_category = None
                if error_category_str:
                    try:
                        error_category = ErrorCategory(error_category_str)
                    except:
                        error_category = ErrorCategory.OTHER
                
                record = PracticeRecord(
                    record_id=record_id,
                    timestamp=timestamp,
                    level=level,
                    exercise_id=exercise_id,
                    is_correct=bool(is_correct),
                    response_time_ms=response_time_ms,
                    error_category=error_category,
                    user_confidence=user_confidence
                )
                records.append(record)
            
            conn.close()
            return records
    
    def get_error_analysis(self, days_back: int = 30) -> Dict[ErrorCategory, int]:
        """Analizza gli errori per categoria"""
        with self.lock:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            
            cutoff_date = (datetime.now() - timedelta(days=days_back)).isoformat()
            
            cursor.execute('''
                SELECT error_category, COUNT(*) as count
                FROM practice_records 
                WHERE timestamp >= ? AND is_correct = 0 AND error_category IS NOT NULL
                GROUP BY error_category
            ''', (cutoff_date,))
            
            error_counts = {}
            for row in cursor.fetchall():
                error_category_str, count = row
                try:
                    error_category = ErrorCategory(error_category_str)
                    error_counts[error_category] = count
                except:
                    pass
            
            conn.close()
            return error_counts
    
    def get_spaced_repetition_exercises(self) -> List[ExerciseMetadata]:
        """Restituisce esercizi per spaced repetition"""
        # Implementazione base - da estendere con tabella spaced_repetition
        with self.lock:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            
            # Per ora restituisce esercizi con win rate < 70%
            cursor.execute('''
                SELECT exercise_id, 
                       SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct, 
                       COUNT(*) as total 
                FROM practice_records 
                GROUP BY exercise_id
                HAVING total >= 3
            ''')
            
            exercises = []
            for row in cursor.fetchall():
                exercise_id, correct, total = row
                win_rate = (correct / total) * 100
                
                if win_rate < 70:  # Esercizi difficili
                    metadata = ExerciseMetadata(
                        exercise_id=exercise_id,
                        easiness_factor=max(1.3, 2.5 - (70 - win_rate) / 50),
                        interval_days=1,
                        repetition_number=0,
                        next_review_date=datetime.now().isoformat(),
                        last_review_date=datetime.now().isoformat()
                    )
                    exercises.append(metadata)
            
            conn.close()
            return exercises
    
    def update_spaced_repetition(self, exercise_id: str, is_correct: bool,
                               user_confidence: int = 3) -> None:
        """Aggiorna i parametri di spaced repetition per un esercizio"""
        # Implementazione base - da estendere con tabella spaced_repetition
        pass
    
    def get_practice_sessions(self, days_back: int = 7) -> List[Dict[str, Any]]:
        """Restituisce le sessioni di pratica"""
        with self.lock:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            
            cutoff_date = (datetime.now() - timedelta(days=days_back)).isoformat()
            
            cursor.execute('''
                SELECT DATE(timestamp) as session_date,
                       COUNT(*) as exercises_attempted,
                       SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as exercises_correct,
                       AVG(response_time_ms) as avg_response_time
                FROM practice_records 
                WHERE timestamp >= ?
                GROUP BY DATE(timestamp)
                ORDER BY session_date DESC
            ''', (cutoff_date,))
            
            sessions = []
            for row in cursor.fetchall():
                session_date, attempted, correct, avg_response = row
                
                session = {
                    'date': session_date,
                    'exercises_attempted': attempted or 0,
                    'exercises_correct': correct or 0,
                    'win_rate': (correct / attempted * 100) if attempted > 0 else 0,
                    'avg_response_time_ms': avg_response or 0
                }
                sessions.append(session)
            
            conn.close()
            return sessions
    
    def clear_history(self, callback: Optional[Callable[[], None]] = None) -> None:
        """Cancella tutta la cronologia"""
        def _clear():
            with self.lock:
                conn = sqlite3.connect(self.db_name)
                cursor = conn.cursor()
                cursor.execute('DELETE FROM sessions')
                cursor.execute('DELETE FROM practice_records')
                conn.commit()
                conn.close()
            if callback:
                callback()
        
        threading.Thread(target=_clear, daemon=True).start()
    
    def export_data(self, filepath: str) -> bool:
        """Esporta i dati in un file"""
        try:
            with self.lock:
                conn = sqlite3.connect(self.db_name)
                
                # Esporta tutte le tabelle
                data = {
                    'sessions': [],
                    'practice_records': [],
                    'export_date': datetime.now().isoformat(),
                    'version': '1.0'
                }
                
                cursor = conn.cursor()
                
                # Esporta sessions
                cursor.execute('SELECT * FROM sessions')
                for row in cursor.fetchall():
                    data['sessions'].append({
                        'id': row[0],
                        'timestamp': row[1],
                        'level': row[2],
                        'chord_type': row[3],
                        'is_correct': bool(row[4])
                    })
                
                # Esporta practice_records
                cursor.execute('SELECT * FROM practice_records')
                for row in cursor.fetchall():
                    data['practice_records'].append({
                        'record_id': row[0],
                        'timestamp': row[1],
                        'level': row[2],
                        'exercise_id': row[3],
                        'is_correct': bool(row[4]),
                        'response_time_ms': row[5],
                        'error_category': row[6],
                        'user_confidence': row[7]
                    })
                
                conn.close()
                
                # Salva su file
                import json
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                
                return True
        except Exception as e:
            print(f"Errore esportazione dati: {e}")
            return False
    
    def import_data(self, filepath: str) -> bool:
        """Importa dati da un file"""
        try:
            import json
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            with self.lock:
                conn = sqlite3.connect(self.db_name)
                cursor = conn.cursor()
                
                # Importa sessions
                if 'sessions' in data:
                    for session in data['sessions']:
                        cursor.execute('''
                            INSERT OR REPLACE INTO sessions 
                            (timestamp, level, chord_type, is_correct)
                            VALUES (?, ?, ?, ?)
                        ''', (
                            session.get('timestamp'),
                            session.get('level'),
                            session.get('chord_type'),
                            session.get('is_correct', False)
                        ))
                
                # Importa practice_records
                if 'practice_records' in data:
                    for record in data['practice_records']:
                        cursor.execute('''
                            INSERT OR REPLACE INTO practice_records 
                            (record_id, timestamp, level, exercise_id, is_correct, 
                             response_time_ms, error_category, user_confidence)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            record.get('record_id'),
                            record.get('timestamp'),
                            record.get('level'),
                            record.get('exercise_id'),
                            record.get('is_correct', False),
                            record.get('response_time_ms'),
                            record.get('error_category'),
                            record.get('user_confidence')
                        ))
                
                conn.commit()
                conn.close()
            
            return True
        except Exception as e:
            print(f"Errore importazione dati: {e}")
            return False
    
    def get_database_size(self) -> int:
        """Restituisce la dimensione del database in byte"""
        import os
        try:
            return os.path.getsize(self.db_name)
        except:
            return 0
    
    def optimize_database(self) -> None:
        """Esegue ottimizzazioni sul database"""
        with self.lock:
            conn = sqlite3.connect(self.db_name)
            cursor = conn.cursor()
            
            # VACUUM per ottimizzare spazio
            cursor.execute('VACUUM')
            
            # ANALYZE per ottimizzare query
            cursor.execute('ANALYZE')
            
            conn.commit()
            conn.close()

# Classe legacy per compatibilità
class DBManager(EnhancedDBManager):
    """Classe legacy per compatibilità con codice esistente"""
    
    def record_answer_async(self, level, chord_type, is_correct):
        """Metodo legacy per compatibilità"""
        record = PracticeRecord(
            record_id=str(uuid.uuid4()),
            timestamp=datetime.now().isoformat(),
            level=level,
            exercise_id=chord_type,
            is_correct=is_correct
        )
        self.record_practice_async(record)
    
    def clear_history_async(self, callback=None):
        """Metodo legacy per compatibilità"""
        self.clear_history(callback)
        
    def get_global_win_rate(self) -> Tuple[int, int, float]:
        """Alias legacy per get_global_stats"""
        return self.get_global_stats()