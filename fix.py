with open(r'C:\Users\Usuario\Desktop\Thay\claude code\betudo-capture\public\painel.html', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix encoding corruption
c = c.replace('â€"', '—').replace('â€™', "'").replace('â€œ', '"').replace('â€\x9d', '"')

# rodadas -> velas (display text only - already done by powershell but re-apply)
# Moon display -> Rosa
c = c.replace("moon:'Moon'", "moon:'Rosa'")
c = c.replace("moon:'Rosa'", "moon:'Rosa'")  # idempotent
# All display Moon/Moons
import re
# Replace Moon in display strings but NOT in JS identifiers like gc()==='moon'
c = c.replace('Moons', 'Rosas')
c = c.replace("Moon — ", "Rosa — ")
c = c.replace("Moon!", "Rosa!")
c = c.replace("Moon ≥", "Rosa ≥")
c = c.replace("Moon}x", "Rosa}x")
c = c.replace(">Moon<", ">Rosa<")
c = c.replace("'Moon'", "'Rosa'")
c = c.replace('"Moon"', '"Rosa"')
c = c.replace(' Moon ', ' Rosa ')
c = c.replace(' Moon:', ' Rosa:')
c = c.replace('· Moon', '· Rosa')
c = c.replace('Moon\n', 'Rosa\n')
# Specific patterns from the template literals
c = c.replace("moon:'Moon'", "moon:'Rosa'")
c = c.replace("LBL={blue:'Azul',purple:'Roxa',green:'Verde',moon:'Moon'}", "LBL={blue:'Azul',purple:'Roxa',green:'Verde',moon:'Rosa'}")
c = c.replace("LBL={blue:'Azul',purple:'Roxa',green:'Verde',moon:'Rosa'}", "LBL={blue:'Azul',purple:'Roxa',green:'Verde',moon:'Rosa'}")

with open(r'C:\Users\Usuario\Desktop\Thay\claude code\betudo-capture\public\painel.html', 'w', encoding='utf-8') as f:
    f.write(c)

print('Done')
