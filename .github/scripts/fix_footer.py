# fix_footer.py - ipo-terminal: 'IPO Terminal - By : Dev Raj' footer element remove. Idempotent.
from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')
old = '<footer class="footer">IPO Terminal - By : Dev Raj</footer>'
if old in s:
    s2 = s.replace(old, '')
    p.write_text(s2, encoding='utf-8')
    print('ipo footer removed')
else:
    print('ipo footer not found (already removed?)')
