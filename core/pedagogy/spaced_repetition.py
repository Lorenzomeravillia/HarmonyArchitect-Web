"""
Implementazione dell'algoritmo di Spaced Repetition (SM-2) per l'apprendimento musicale.
Basato sul sistema SuperMemo per intervalli di ripetizione ottimali.
"""

import math
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from core.models.exercise_model import SpacedRepetitionData, Exercise, DifficultyLevel

class SpacedRepetitionEngine:
    """Engine per gestione spaced repetition per esercizi musicali"""
    
    def __init__(self):
        self.exercise_data: Dict[str, SpacedRepetitionData] = {}
    
    def update_exercise(self, exercise_id: str, is_correct: bool, 
                       confidence: int = 3, response_time_ms: Optional[int] = None) -> SpacedRepetitionData:
        """
        Aggiorna i dati di spaced repetition per un esercizio dopo una risposta.
        
        Args:
            exercise_id: ID dell'esercizio
            is_correct: True se la risposta era corretta
            confidence: Fiducia dell'utente (1-5)
            response_time_ms: Tempo di risposta in millisecondi
        
        Returns:
            Dati spaced repetition aggiornati
        """
        if exercise_id not in self.exercise_data:
            # Creazione dati iniziali per nuovo esercizio
            self.exercise_data[exercise_id] = SpacedRepetitionData(
                exercise_id=exercise_id,
                easiness_factor=2.5,
                interval_days=1,
                repetition_number=0
            )
        
        data = self.exercise_data[exercise_id]
        data.calculate_next_interval(is_correct, confidence)
        
        return data
    
    def get_exercises_for_review(self) -> List[str]:
        """
        Restituisce gli esercizi che dovrebbero essere rivisti oggi.
        
        Returns:
            Lista di ID esercizi ordinati per priorità
        """
        now = datetime.now()
        exercises_for_review = []
        
        for exercise_id, data in self.exercise_data.items():
            review_date = datetime.fromisoformat(data.next_review_date)
            
            # Se la data di review è passata o è oggi
            if review_date <= now:
                # Calcola priorità: esercizi con EF più basso (più difficili) hanno priorità più alta
                priority = 1.0 / data.easiness_factor
                
                # Aggiungi penalità se non rivisto per molto tempo
                days_overdue = (now - review_date).days
                if days_overdue > 0:
                    priority *= (1 + days_overdue * 0.1)
                
                exercises_for_review.append((exercise_id, priority))
        
        # Ordina per priorità (più alta prima)
        exercises_for_review.sort(key=lambda x: x[1], reverse=True)
        return [ex_id for ex_id, _ in exercises_for_review]
    
    def get_exercise_priority(self, exercise_id: str) -> float:
        """
        Calcola la priorità di un esercizio per spaced repetition.
        
        Args:
            exercise_id: ID dell'esercizio
        
        Returns:
            Priorità (0.0-10.0)
        """
        if exercise_id not in self.exercise_data:
            return 5.0  # Priorità media per esercizi nuovi
        
        data = self.exercise_data[exercise_id]
        now = datetime.now()
        review_date = datetime.fromisoformat(data.next_review_date)
        
        # Priorità base inversamente proporzionale a EF (EF basso = esercizio difficile = alta priorità)
        base_priority = 1.0 / data.easiness_factor
        
        # Aggiungi fattore temporale: esercizi più "overdue" hanno priorità più alta
        if review_date < now:
            days_overdue = (now - review_date).days
            time_factor = 1 + days_overdue * 0.2
        else:
            days_until = (review_date - now).days
            time_factor = 1 - min(days_until * 0.1, 0.5)  # Riduce priorità se review è in futuro
        
        return base_priority * time_factor
    
    def get_review_schedule(self, days: int = 30) -> Dict[str, List[str]]:
        """
        Genera un calendario di review per i prossimi giorni.
        
        Args:
            days: Numero di giorni da pianificare
        
        Returns:
            Dict: giorno -> lista di ID esercizi per review
        """
        schedule = {}
        today = datetime.now()
        
        for day_offset in range(days):
            target_date = today + timedelta(days=day_offset)
            date_str = target_date.strftime("%Y-%m-%d")
            
            exercises_for_day = []
            for exercise_id, data in self.exercise_data.items():
                review_date = datetime.fromisoformat(data.next_review_date)
                if review_date.date() == target_date.date():
                    exercises_for_day.append(exercise_id)
            
            if exercises_for_day:
                schedule[date_str] = exercises_for_day
        
        return schedule
    
    def export_data(self) -> Dict[str, Dict[str, Any]]:
        """
        Esporta i dati di spaced repetition.
        
        Returns:
            Dict con tutti i dati per esportazione
        """
        export_data = {}
        for exercise_id, data in self.exercise_data.items():
            export_data[exercise_id] = {
                'easiness_factor': data.easiness_factor,
                'interval_days': data.interval_days,
                'repetition_number': data.repetition_number,
                'next_review_date': data.next_review_date,
                'last_review_date': data.last_review_date,
                'last_review_correct': data.last_review_correct,
                'last_confidence': data.last_confidence
            }
        return export_data
    
    def import_data(self, data: Dict[str, Dict[str, Any]]) -> None:
        """
        Importa dati di spaced repetition.
        
        Args:
            data: Dict con dati da importare
        """
        for exercise_id, ex_data in data.items():
            self.exercise_data[exercise_id] = SpacedRepetitionData(
                exercise_id=exercise_id,
                easiness_factor=ex_data['easiness_factor'],
                interval_days=ex_data['interval_days'],
                repetition_number=ex_data['repetition_number'],
                next_review_date=ex_data['next_review_date'],
                last_review_date=ex_data['last_review_date'],
                last_review_correct=ex_data['last_review_correct'],
                last_confidence=ex_data['last_confidence']
            )