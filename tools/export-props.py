"""Ritaglia i nuovi elementi di scena dai fogli originali (richiede Pillow)."""
from assetlib import alpha_bbox, load, output_path

from PIL import Image


def export(source, name, box=None, width=None, height=None):
    image = load(source)
    if box:
        image = image.crop(box)
    image = image.crop(alpha_bbox(image, 16))
    scale = width / image.width if width else height / image.height
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    image.save(output_path(name), quality=88, method=6)
    print(f'{name}: {image.width} × {image.height}, {output_path(name).stat().st_size // 1024} KB')


def export_props():
    export('Banco da lavoro cyberpunk con server.png', 'workbench.webp', width=800)
    docks = 'Banchine industriali modulari in pixel art.png'
    export(docks, 'dock-deck.webp', (20, 208, 1518, 367), width=720)
    export(docks, 'dock-supported.webp', (210, 475, 1327, 742), width=720)

    lights = 'Lampioni e dissuasori cyberpunk in pixel art-2.png'
    export(lights, 'lamp-single.webp', (0, 0, 720, 735), height=360)
    export(lights, 'lamp-double.webp', (720, 0, 1367, 735), height=360)
    for i, name in enumerate(['home', 'about', 'projects', 'contact']):
        export(lights, f'bollard-{name}.webp', (i * 1367 // 4, 735, (i + 1) * 1367 // 4, 1151), height=128)

    modules = 'Set di moduli cyberpunk in pixel art-3.png'
    for name, box, width in [
        ('cable-loop', (20, 20, 570, 350), 320),
        ('cable-straight', (590, 100, 1190, 320), 320),
        ('cable-elbow', (1190, 20, 1520, 390), 180),
        ('junction', (70, 420, 540, 760), 240),
        ('vent', (580, 450, 1020, 740), 240),
    ]:
        export(modules, f'{name}.webp', box, width=width)

    for name, box in [
        ('skyline-far', (0, 0, 1536, 385)),
        ('skyline-mid', (0, 385, 1536, 645)),
        ('skyline-near', (0, 645, 1536, 1024)),
    ]:
        export('Tre skyline cyberpunk in pixel art-1.png', f'{name}.webp', box, width=1536)

    # La base della parabola resta ferma mentre disco e segnale si animano.
    sheet = load('Modulo radio cyberpunk in otto fotogrammi.png')
    frames = []
    for row in range(2):
        for column in range(4):
            frame = sheet.crop((column * sheet.width // 4, row * sheet.height // 2,
                                (column + 1) * sheet.width // 4, (row + 1) * sheet.height // 2))
            frames.append(frame.crop(alpha_bbox(frame, 16)))
    scale = min(248 / max(f.width for f in frames), 248 / max(f.height for f in frames))
    atlas = Image.new('RGBA', (256 * 8, 256))
    for i, frame in enumerate(frames):
        base = frame.getchannel('A').crop((0, round(frame.height * .8), frame.width, frame.height))
        bounds = base.point(lambda a: 255 if a > 64 else 0).getbbox()
        anchor = (bounds[0] + bounds[2]) / 2
        frame = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.LANCZOS)
        atlas.paste(frame, (i * 256 + 128 - round(anchor * scale), 256 - frame.height))
    atlas.save(output_path('radio.webp'), quality=88, method=6)


if __name__ == '__main__':
    export_props()
