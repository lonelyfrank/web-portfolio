"""Register actor-only sheets by authored floor/hand keypoints, never alpha bounds.

A fixed scale preserves Frank's standing height (96px). Equipment is rendered
separately and never replaced. Source keypoints are measured in each grid cell.
Run: python3 tools/export-interactions.py (Pillow).
"""
from assetlib import load, output_path
from PIL import Image

CELL = (144, 136)
FLOOR = 132
# Floor registration is constant across each row. Hand targets translate the
# Contact actor only, to the panel or the left rim of the tuning control.
CONTACT_HANDS = [None, (300, 376), (322, 374), (310, 331), (320, 270), (333, 291), None, None]
CONTACT_TARGETS = [None, (87, 111), (87, 111), (123, 103), (123, 103), (87, 105), None, None]


def actors(source, name, scale, rows, ground, origins):
    sheet = load(source)
    atlas = Image.new('RGBA', (CELL[0] * 8, CELL[1]))
    for index in range(8):
        row, column = divmod(index, 4)
        x, y = column * 444, rows[row]
        end = rows[row + 1] if row == 0 else sheet.height
        frame = sheet.crop((x, y, min(x + 444, sheet.width), end))
        frame = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.NEAREST)
        # Paste into a separate cell so transparent margins cannot spill into
        # adjacent frames. No per-frame bounding-box or head recentering.
        cell = Image.new('RGBA', CELL)
        cell.paste(frame, (round(origins[index]), FLOOR - round(ground[row] * scale)))
        atlas.paste(cell, (index * CELL[0], 0))
    atlas.save(output_path(f'interaction-{name}.webp'), lossless=True, method=6)


def export_interactions():
    actors('character_interaction_desk_about.png', 'about', 96 / 438,
           (0, 443), (442, 443), [36] * 8)
    scale = 96 / 380
    origins = [target[0] - hand[0] * scale if hand else 4
               for hand, target in zip(CONTACT_HANDS, CONTACT_TARGETS)]
    for index, (hand, target) in enumerate(zip(CONTACT_HANDS, CONTACT_TARGETS)):
        if hand:
            floor = (460, 396)[index // 4]
            # Keep feet planted; the hand must overlap the control's 4px radius.
            assert abs(FLOOR - (floor - hand[1]) * scale - target[1]) <= 4
    actors('character_interaction_radio_contact.png', 'contact', scale,
           (0, 470), (460, 396), origins)
    sheet = load('dock_modules_sheet.png')
    for name, box in [('left', (48, 810, 383, 960)), ('right', (1152, 810, 1492, 960))]:
        sheet.crop(box).save(output_path(f'rail-end-{name}.webp'), lossless=True, method=6)
    # Existing projector asset, base only. No invented character interaction.
    projector = load('station_projector.png')
    projector.crop((25, 648, 746, 980)).resize((160, 74), Image.Resampling.NEAREST).save(
        output_path('projector.webp'), lossless=True, method=6)


if __name__ == '__main__':
    export_interactions()
