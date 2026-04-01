import os, requests
from dotenv import load_dotenv
load_dotenv()

r = requests.post('https://openrouter.ai/api/v1/chat/completions',
    headers={'Authorization': f'Bearer {os.getenv("OPENROUTER_API_KEY")}', 'Content-Type': 'application/json'},
    json={'model': 'deepseek/deepseek-chat', 'messages': [{'role': 'user', 'content': 'Rispondi solo: OK'}], 'max_tokens': 10})

print('STATUS:', r.status_code)
print('RISPOSTA:', r.json()['choices'][0]['message']['content'])
