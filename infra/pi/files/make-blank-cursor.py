#!/usr/bin/env python3
"""Erzeugt ein Xcursor-Theme mit einem transparenten 1×1-Cursor für alle gängigen Cursor-Namen."""
import os
import struct
import sys

theme_dir = sys.argv[1] if len(sys.argv) > 1 else "/usr/share/icons/einlass-blank"
cursors = os.path.join(theme_dir, "cursors")
os.makedirs(cursors, exist_ok=True)

# Xcursor: Datei-Header, 1 TOC-Eintrag, 1 Bild-Chunk (1×1, ARGB = 0 → transparent)
IMAGE_TYPE = 0xFFFD0002
size = 1
header = struct.pack("<4sIII", b"Xcur", 16, 0x10000, 1)
toc = struct.pack("<III", IMAGE_TYPE, size, 16 + 12)
chunk = struct.pack("<IIIIIIIII", 36, IMAGE_TYPE, size, 1, 1, 1, 0, 0, 0) + struct.pack("<I", 0)
data = header + toc + chunk

names = """default left_ptr arrow top_left_arrow pointer hand1 hand2 text xterm ibeam
wait watch progress left_ptr_watch crosshair cross move fleur grab grabbing
not-allowed no-drop help question_arrow context-menu cell vertical-text alias copy
all-scroll col-resize row-resize n-resize s-resize e-resize w-resize ne-resize nw-resize
se-resize sw-resize ew-resize ns-resize nesw-resize nwse-resize sb_h_double_arrow
sb_v_double_arrow zoom-in zoom-out""".split()

for name in names:
    with open(os.path.join(cursors, name), "wb") as f:
        f.write(data)

with open(os.path.join(theme_dir, "index.theme"), "w") as f:
    f.write("[Icon Theme]\nName=einlass-blank\nComment=Unsichtbarer Cursor für den Kiosk\n")
print(f"{len(names)} Cursor in {cursors}")
