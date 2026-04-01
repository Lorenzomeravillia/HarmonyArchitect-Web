import os

file_path = "app_gui.py"
with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Update UI Layout to put Answers on the right
layout_old = """        # 2.5 Visual Staff (Canvas)
        self.staff_frame = ctk.CTkFrame(self.main_scrollview, fg_color="#050814", corner_radius=10, border_width=2, border_color="#101A35")
        self.staff_frame.pack(pady=8, padx=20, fill="x")
        self.staff_canvas = ctk.CTkCanvas(self.staff_frame, height=350, bg="#050814", highlightthickness=0)
        self.staff_canvas.pack(fill="x", padx=5, pady=5)
        self.staff_canvas.bind("<Button-1>", self._on_staff_click)
        
        # 2.6 Voice Isolation (Solo)
        self.solo_frame = self.create_panel(self.main_scrollview)
        self.solo_frame.pack(pady=5, padx=20, fill="x")
        
        ctk.CTkLabel(self.solo_frame, text="ISOLATE:", font=("Arial", 13, "bold"), text_color="#A0AEC0").pack(side="left", padx=10, pady=10)
        
        SOLO_LABELS = ["BASS", "V2", "V3", "V4", "V5", "V6", "TOP"]
        btn_kwargs = dict(width=72, height=35, fg_color="#1C2541", border_width=1, border_color="#3A4B75", text_color="#A0AEC0", font=("Arial", 11, "bold"))
        self.solo_btns = []
        for k, lbl in enumerate(SOLO_LABELS):
            b = ctk.CTkButton(self.solo_frame, text=lbl, command=lambda idx=k: self.controller.on_play_layer(idx) if self.controller else None, state="disabled", **btn_kwargs)
            b.pack(side="left", padx=4)
            self.solo_btns.append(b)
        
        # 3. Dynamic Answers Grid (MPC Style)
        self.answers_frame = ctk.CTkFrame(self.main_scrollview, fg_color="transparent")
        self.answers_frame.pack(pady=5, padx=20, fill="x")
        
        self.answer_buttons = []
        for i in range(4):
            btn = ctk.CTkButton(self.answers_frame, text=f"Opzione {i+1}", font=("Arial", 15, "bold"), height=52,
                                fg_color="#1C2541", border_width=2, border_color="#2A375E", hover_color="#2A375E",
                                command=lambda idx=i: self.controller.on_check_answer(idx) if self.controller else None)
            btn.grid(row=i//2, column=i%2, padx=12, pady=8, sticky="nsew")
            self.answer_buttons.append(btn)
            
        self.answers_frame.grid_columnconfigure(0, weight=1)
        self.answers_frame.grid_columnconfigure(1, weight=1)"""

layout_new = """        # 2.5 Visual Staff (Canvas) and Answers Side-by-Side
        self.middle_frame = ctk.CTkFrame(self.main_scrollview, fg_color="transparent")
        self.middle_frame.pack(pady=8, padx=20, fill="x")

        self.staff_frame = ctk.CTkFrame(self.middle_frame, fg_color="#050814", corner_radius=10, border_width=2, border_color="#101A35")
        self.staff_frame.pack(side="left", fill="both", expand=True)
        self.staff_canvas = ctk.CTkCanvas(self.staff_frame, height=440, bg="#050814", highlightthickness=0)
        self.staff_canvas.pack(fill="both", expand=True, padx=5, pady=5)
        self.staff_canvas.bind("<Button-1>", self._on_staff_click)
        
        # 3. Dynamic Answers Grid (Vertical on right)
        self.answers_frame = ctk.CTkFrame(self.middle_frame, fg_color="transparent")
        self.answers_frame.pack(side="right", fill="y", padx=(15, 0))
        
        self.answer_buttons = []
        for i in range(4):
            btn = ctk.CTkButton(self.answers_frame, text=f"Opzione {i+1}", font=("Arial", 15, "bold"), height=90, width=190,
                                fg_color="#1C2541", border_width=2, border_color="#2A375E", hover_color="#2A375E",
                                command=lambda idx=i: self.controller.on_check_answer(idx) if self.controller else None)
            btn.grid(row=i, column=0, pady=10, sticky="nsew")
            self.answer_buttons.append(btn)
            
        self.answers_frame.grid_columnconfigure(0, weight=1)
        for i in range(4): self.answers_frame.grid_rowconfigure(i, weight=1)

        # 2.6 Voice Isolation (Solo)
        self.solo_frame = self.create_panel(self.main_scrollview)
        self.solo_frame.pack(pady=5, padx=20, fill="x")
        
        ctk.CTkLabel(self.solo_frame, text="ISOLATE:", font=("Arial", 13, "bold"), text_color="#A0AEC0").pack(side="left", padx=10, pady=10)
        
        SOLO_LABELS = ["BASS", "V2", "V3", "V4", "V5", "V6", "TOP"]
        btn_kwargs = dict(width=72, height=35, fg_color="#1C2541", border_width=1, border_color="#3A4B75", text_color="#A0AEC0", font=("Arial", 11, "bold"))
        self.solo_btns = []
        for k, lbl in enumerate(SOLO_LABELS):
            b = ctk.CTkButton(self.solo_frame, text=lbl, command=lambda idx=k: self.controller.on_play_layer(idx) if self.controller else None, state="disabled", **btn_kwargs)
            b.pack(side="left", padx=4)
            self.solo_btns.append(b)"""
text = text.replace(layout_old, layout_new)

# 2. Update draw_empty_staff sizing
text = text.replace('360-i', '460-i') # rectangle bounds

text = text.replace('[85, 100, 115, 130, 145]', '[80, 100, 120, 140, 160]') # Treble
text = text.replace('text="𝄞", fill="#4A65A5", font=("Arial", 90)', 'text="𝄞", fill="#4A65A5", font=("Arial", 115))') # bigger clef
text = text.replace('(45, 115, text="𝄞")', '(45, 120, text="𝄞")')

text = text.replace('[225, 240, 255, 270, 285]', '[260, 280, 300, 320, 340]') # Bass
text = text.replace('text="𝄢", fill="#4A65A5", font=("Arial", 75)', 'text="𝄢", fill="#4A65A5", font=("Arial", 95))') # bigger clef
text = text.replace('(45, 255, text="𝄢")', '(45, 300, text="𝄢")')

text = text.replace('30, 85, 30, 285', '30, 80, 30, 340') # Bracket

# 3. Update draw_pitches_on_staff math
text = text.replace('spacing = 700 /', 'spacing = 520 /')
text = text.replace('lx = 640', 'lx = 480') # legend shift left due to smaller width

# replace y math exactly
text = text.replace('y = (225 - (step - 26) * 7.5) if j == 0 else (145 - (step - 30) * 7.5)', 'y = (260 - (step - 26) * 10) if j == 0 else (160 - (step - 30) * 10)')

# 4. Update ledgers
# Bass bottom
text = text.replace('y >= 300:', 'y >= 360:')
text = text.replace('range(300, int(y)+5, 15)', 'range(360, int(y)+5, 20)')
# Bass top
text = text.replace('y <= 210:', 'y <= 240:')
text = text.replace('range(210, int(y)-5, -15)', 'range(240, int(y)-5, -20)')
# Treble bottom
text = text.replace('y >= 160:', 'y >= 180:')
text = text.replace('range(160, int(y)+5, 15)', 'range(180, int(y)+5, 20)')
# Treble top
text = text.replace('y <= 70:', 'y <= 60:')
text = text.replace('range(70, int(y)-5, -15)', 'range(60, int(y)-5, -20)')

# 5. Update note ovals (make them thicker/larger)
text = text.replace('x_draw+3, y-2, x_draw+19, y+10', 'x_draw+3, y-4, x_draw+23, y+13') # shadow
text = text.replace('x_draw, y-6, x_draw+16, y+6', 'x_draw, y-8, x_draw+20, y+8') # base
text = text.replace('x_draw+2, y-3, x_draw+8, y+2', 'x_draw+3, y-5, x_draw+10, y+3') # gloss
text = text.replace('x_draw - 4, y - 12, x_draw + 20, y + 12', 'x_draw - 5, y - 15, x_draw + 25, y + 15') # hitbox

# Write back
with open(file_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Modifiche v2 completate con successo!")
