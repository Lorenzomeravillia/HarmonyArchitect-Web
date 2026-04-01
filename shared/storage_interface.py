"""
Storage Interface Contract per architettura cross-platform.
Definisce l'interfaccia astratta per le operazioni di storage che devono essere
implementate da ogni piattaforma (desktop, Android, etc.).
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Tuple, Callable
from datetime import datetime
from enum import Enum
from dataclasses import dataclass

class ErrorCategory(Enum):
    """Categorie di errori per analisi pedagogica"""
    MAJOR_MINOR_CONFUSION = "major_minor_confusion"
    SEVENTH_CONFUSION = "seventh_confusion"
    EXTENSION_CONFUSION = "extension_confusion"
    ALTERATION_CONFUSION = "alteration_confusion"
    ROOT_CONFUSION = "root_confusion"
    VOICING_CONFUSION = "voicing_confusion"
    PROGRESSION_CONFUSION = "progression_confusion"
    OTHER = "other"

class PracticeMode(Enum):
    """Modalità di pratica"""
    STANDARD = "standard"
    ADAPTIVE = "adaptive"
    SPACED_REPETITION = "spaced_repetition"
    FOCUSED_PRACTICE = "focused_practice"

@dataclass
class PracticeRecord:
    """Record di una pratica individuale"""
    record_id: str
    timestamp: str
    level: str
    exercise_id: str
    is_correct: bool
    response_time_ms: Optional[int] = None
    error_category: Optional[ErrorCategory] = None
    user_confidence: Optional[int] = None  # 1-5 scale
    
@dataclass
class ExerciseMetadata:
    """Metadati di un esercizio per spaced repetition"""
    exercise_id: str
    easiness_factor: float  # EF per algoritmo SM-2
    interval_days: int  # Intervallo in giorni per prossima ripetizione
    repetition_number: int  # Numero di ripetizioni consecutive corrette
    next_review_date: str  # Data prossima ripetizione (ISO format)
    last_review_date: str  # Data ultima ripetizione (ISO format)

class StorageInterface(ABC):
    """Interfaccia astratta per operazioni di storage cross-platform"""
    
    @abstractmethod
    def __init__(self, db_name: str = "harmony_history.db"):
        """
        Inizializza lo storage.
        
        Args:
            db_name: Nome del database/file di storage
        """
        pass
    
    @abstractmethod
    def record_practice(self, record: PracticeRecord) -> None:
        """
        Registra una pratica nel database.
        
        Args:
            record: Record della pratica da salvare
        """
        pass
    
    @abstractmethod
    def record_practice_async(self, record: PracticeRecord, 
                            callback: Optional[Callable[[], None]] = None) -> None:
        """
        Registra una pratica in modo asincrono.
        
        Args:
            record: Record della pratica da salvare
            callback: Callback opzionale da eseguire dopo il salvataggio
        """
        pass
    
    @abstractmethod
    def get_global_stats(self) -> Tuple[int, int, float]:
        """
        Restituisce statistiche globali.
        
        Returns:
            Tuple: (correct_count, total_count, win_rate_percentage)
        """
        pass
    
    @abstractmethod
    def get_level_stats(self, level_name: str) -> Dict[str, Tuple[int, int, float]]:
        """
        Restituisce statistiche per livello.
        
        Args:
            level_name: Nome del livello
            
        Returns:
            Dict: exercise_id -> (correct_count, total_count, win_rate)
        """
        pass
    
    @abstractmethod
    def get_exercise_stats(self, exercise_id: str) -> Optional[Tuple[int, int, float]]:
        """
        Restituisce statistiche per un esercizio specifico.
        
        Args:
            exercise_id: ID dell'esercizio
            
        Returns:
            Tuple: (correct_count, total_count, win_rate) o None se non trovato
        """
        pass
    
    @abstractmethod
    def get_recent_practices(self, limit: int = 50) -> List[PracticeRecord]:
        """
        Restituisce le pratiche più recenti.
        
        Args:
            limit: Numero massimo di record da restituire
            
        Returns:
            Lista di record di pratica
        """
        pass
    
    @abstractmethod
    def get_error_analysis(self, days_back: int = 30) -> Dict[ErrorCategory, int]:
        """
        Analizza gli errori per categoria.
        
        Args:
            days_back: Numero di giorni da considerare
            
        Returns:
            Dict: Categoria errore -> conteggio
        """
        pass
    
    @abstractmethod
    def get_spaced_repetition_exercises(self) -> List[ExerciseMetadata]:
        """
        Restituisce esercizi per spaced repetition.
        
        Returns:
            Lista di metadati esercizi ordinati per priorità
        """
        pass
    
    @abstractmethod
    def update_spaced_repetition(self, exercise_id: str, is_correct: bool,
                               user_confidence: int = 3) -> None:
        """
        Aggiorna i parametri di spaced repetition per un esercizio.
        
        Args:
            exercise_id: ID dell'esercizio
            is_correct: True se la risposta era corretta
            user_confidence: Fiducia dell'utente (1-5)
        """
        pass
    
    @abstractmethod
    def get_practice_sessions(self, days_back: int = 7) -> List[Dict[str, Any]]:
        """
        Restituisce le sessioni di pratica.
        
        Args:
            days_back: Numero di giorni da considerare
            
        Returns:
            Lista di sessioni con metadati
        """
        pass
    
    @abstractmethod
    def clear_history(self, callback: Optional[Callable[[], None]] = None) -> None:
        """
        Cancella tutta la cronologia.
        
        Args:
            callback: Callback opzionale da eseguire dopo la cancellazione
        """
        pass
    
    @abstractmethod
    def export_data(self, filepath: str) -> bool:
        """
        Esporta i dati in un file.
        
        Args:
            filepath: Percorso del file di esportazione
            
        Returns:
            True se esportazione riuscita, False altrimenti
        """
        pass
    
    @abstractmethod
    def import_data(self, filepath: str) -> bool:
        """
        Importa dati da un file.
        
        Args:
            filepath: Percorso del file di importazione
            
        Returns:
            True se importazione riuscita, False altrimenti
        """
        pass
    
    @abstractmethod
    def get_database_size(self) -> int:
        """
        Restituisce la dimensione del database in byte.
        
        Returns:
            Dimensione in byte
        """
        pass
    
    @abstractmethod
    def optimize_database(self) -> None:
        """Esegue ottimizzazioni sul database."""
        pass