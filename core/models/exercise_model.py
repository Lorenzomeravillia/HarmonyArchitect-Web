"""
Modelli di dati per esercizi e pratica musicale.
Contiene le classi di dati utilizzate in tutto il sistema.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid
from datetime import datetime

class ExerciseType(Enum):
    """Tipi di esercizio disponibili"""
    SINGLE_CHORD = "single_chord"
    CHORD_PROGRESSION = "chord_progression"

class DifficultyLevel(Enum):
    """Livelli di difficoltà"""
    TRIADS_BASIC = "1: Triadi Base"
    SEVENTHS_DROP2 = "2: Settime (Drop 2)"
    JAZZ_EXTENSIONS = "3: Jazz Extensions"
    ADVANCED_SUBS = "4: Advanced (Subs/Alt)"

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

@dataclass
class PitchWrapper:
    """Wrapper per oggetti pitch (astrazione per music21.pitch)"""
    midi_number: int
    frequency: float
    name: str
    
    @property
    def midi(self) -> int:
        return self.midi_number

@dataclass
class Exercise:
    """Definizione di un esercizio completo"""
    exercise_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    exercise_type: ExerciseType = ExerciseType.SINGLE_CHORD
    difficulty: DifficultyLevel = DifficultyLevel.TRIADS_BASIC
    
    # Contenuto dell'esercizio
    target_chord: Optional[str] = None  # Per single chord
    target_progression: Optional[List[str]] = None  # Per progressioni
    target_name: str = ""  # Nome visualizzato
    
    # Opzioni di risposta
    options: List[str] = field(default_factory=list)
    correct_option_index: int = 0
    
    # Metadati pedagogici
    musical_concepts: List[str] = field(default_factory=list)  # Es: ["triad", "major", "root_position"]
    common_errors: List[ErrorCategory] = field(default_factory=list)
    prerequisite_exercises: List[str] = field(default_factory=list)  # ID esercizi prerequisito
    
    # Statistiche (popolate dinamicamente)
    stats_correct: int = 0
    stats_total: int = 0
    stats_win_rate: float = 0.0
    
    def get_display_name(self) -> str:
        """Restituisce il nome visualizzato dell'esercizio"""
        if self.exercise_type == ExerciseType.SINGLE_CHORD:
            return self.target_chord or self.target_name
        else:
            return self.target_name

@dataclass
class PracticeSession:
    """Sessione di pratica"""
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    start_time: str = field(default_factory=lambda: datetime.now().isoformat())
    end_time: Optional[str] = None
    duration_minutes: int = 0
    level: DifficultyLevel = DifficultyLevel.TRIADS_BASIC
    mode: str = "adaptive"  # adaptive, spaced_repetition, focused
    
    # Statistiche sessione
    exercises_attempted: int = 0
    exercises_correct: int = 0
    total_response_time_ms: int = 0
    
    # Esercizi nella sessione
    exercise_ids: List[str] = field(default_factory=list)
    
    def calculate_win_rate(self) -> float:
        """Calcola il win rate della sessione"""
        if self.exercises_attempted == 0:
            return 0.0
        return (self.exercises_correct / self.exercises_attempted) * 100
    
    def get_average_response_time(self) -> float:
        """Calcola il tempo medio di risposta"""
        if self.exercises_attempted == 0:
            return 0.0
        return self.total_response_time_ms / self.exercises_attempted

@dataclass
class UserProgress:
    """Progresso dell'utente"""
    user_id: str = "default"
    
    # Statistiche globali
    total_sessions: int = 0
    total_exercises_attempted: int = 0
    total_exercises_correct: int = 0
    total_practice_minutes: int = 0
    
    # Progresso per livello
    level_progress: Dict[DifficultyLevel, Dict[str, Any]] = field(default_factory=dict)
    
    # Milestone raggiunte
    milestones_achieved: List[str] = field(default_factory=list)
    
    # Preferenze
    preferred_instruments: Dict[int, str] = field(default_factory=dict)  # channel -> instrument
    settings: Dict[str, Any] = field(default_factory=dict)
    
    def get_global_win_rate(self) -> float:
        """Calcola il win rate globale"""
        if self.total_exercises_attempted == 0:
            return 0.0
        return (self.total_exercises_correct / self.total_exercises_attempted) * 100
    
    def get_level_win_rate(self, level: DifficultyLevel) -> float:
        """Calcola il win rate per un livello specifico"""
        if level not in self.level_progress:
            return 0.0
        
        stats = self.level_progress[level]
        attempted = stats.get('attempted', 0)
        if attempted == 0:
            return 0.0
        
        correct = stats.get('correct', 0)
        return (correct / attempted) * 100

@dataclass
class SpacedRepetitionData:
    """Dati per algoritmo di spaced repetition (SM-2)"""
    exercise_id: str
    easiness_factor: float = 2.5  # EF iniziale
    interval_days: int = 1  # Intervallo iniziale
    repetition_number: int = 0  # Numero di ripetizioni consecutive corrette
    next_review_date: str = field(default_factory=lambda: datetime.now().isoformat())
    last_review_date: str = field(default_factory=lambda: datetime.now().isoformat())
    last_review_correct: bool = False
    last_confidence: int = 3  # 1-5 scale
    
    def calculate_next_interval(self, is_correct: bool, confidence: int = 3) -> None:
        """
        Calcola il prossimo intervallo usando algoritmo SM-2.
        
        Args:
            is_correct: True se la risposta era corretta
            confidence: Fiducia dell'utente (1-5)
        """
        import math
        from datetime import datetime, timedelta
        
        now = datetime.now()
        self.last_review_date = now.isoformat()
        self.last_review_correct = is_correct
        self.last_confidence = confidence
        
        if not is_correct:
            # Risposta errata: reset a intervallo di 1 giorno
            self.repetition_number = 0
            self.interval_days = 1
        else:
            # Risposta corretta: aggiorna EF e calcola nuovo intervallo
            q = max(1, min(5, confidence))  # q = 5 - confidence (ma invertito per nostra scala)
            self.easiness_factor = max(1.3, self.easiness_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
            
            if self.repetition_number == 0:
                self.interval_days = 1
            elif self.repetition_number == 1:
                self.interval_days = 6
            else:
                self.interval_days = math.ceil(self.interval_days * self.easiness_factor)
            
            self.repetition_number += 1
        
        # Calcola prossima data di review
        next_review = now + timedelta(days=self.interval_days)
        self.next_review_date = next_review.isoformat()