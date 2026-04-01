import os

file_path = "app_gui.py"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Main scrollview
text = text.replace(
    '        # 1. Header & Level Selection\n        self.top_frame = self.create_panel(self)',
    '        # Main Scrollable Wrapper\n        self.main_scrollview = ctk.CTkScrollableFrame(self, fg_color="transparent")\n        self.main_scrollview.pack(fill="both", expand=True)\n\n        # 1. Header & Level Selection\n        self.top_frame = self.create_panel(self.main_scrollview)'
)

# 2. Update parents
blocks = [
    ('self.settings_frame = self.create_panel(self)', 'self.settings_frame = self.create_panel(self.main_scrollview)'),
    ('self.instruments_row = self.create_panel(self)', 'self.instruments_row = self.create_panel(self.main_scrollview)'),
    ('self.play_frame = self.create_panel(self)', 'self.play_frame = self.create_panel(self.main_scrollview)'),
    ('self.staff_frame = ctk.CTkFrame(self, fg_color="#050814", corner_radius=10, border_width=2, border_color="#101A35")', 'self.staff_frame = ctk.CTkFrame(self.main_scrollview, fg_color="#050814", corner_radius=10, border_width=2, border_color="#101A35")'),
    ('self.staff_canvas = ctk.CTkCanvas(self.staff_frame, height=290, bg="#050814", highlightthickness=0)', 'self.staff_canvas = ctk.CTkCanvas(self.staff_frame, height=350, bg="#050814", highlightthickness=0)'),
    ('self.solo_frame = self.create_panel(self)', 'self.solo_frame = self.create_panel(self.main_scrollview)'),
    ('self.answers_frame = ctk.CTkFrame(self, fg_color="transparent")', 'self.answers_frame = ctk.CTkFrame(self.main_scrollview, fg_color="transparent")'),
    ('insight_frame = ctk.CTkFrame(self, fg_color="transparent")', 'insight_frame = ctk.CTkFrame(self.main_scrollview, fg_color="transparent")')
]

for old, new in blocks:
    text = text.replace(old, new)

# 3. Y offsets for 45px shift
text = text.replace('300-i', '360-i')
text = text.replace('[40, 55, 70, 85, 100]', '[85, 100, 115, 130, 145]')
text = text.replace('(45, 70, text="𝄞"', '(45, 115, text="𝄞"')
text = text.replace('[180, 195, 210, 225, 240]', '[225, 240, 255, 270, 285]')
text = text.replace('(45, 210, text="𝄢"', '(45, 255, text="𝄢"')
text = text.replace('30, 40, 30, 240', '30, 85, 30, 285')

text = text.replace('(180 - (step - 26) * 7.5)', '(225 - (step - 26) * 7.5)')
text = text.replace('(100 - (step - 30) * 7.5)', '(145 - (step - 30) * 7.5)')

text = text.replace('y >= 255:', 'y >= 300:')
text = text.replace('range(255,', 'range(300,')
text = text.replace('y <= 165:', 'y <= 210:')
text = text.replace('range(165,', 'range(210,')
text = text.replace('y >= 115:', 'y >= 160:')
text = text.replace('range(115,', 'range(160,')
text = text.replace('y <= 25:', 'y <= 70:')
text = text.replace('range(25,', 'range(70,')

with open(file_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Modifiche completate con successo!")
