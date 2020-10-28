import sys
sys.path.append('/ws/deps')
import dice
import json

roll = []

with open('input.json') as jsonFile:
    data = json.load(jsonFile)
    roll = dice.roll(data['roll'])
    print(roll)

res = {}
res['output'] = roll

with open('output.json', 'w') as outfile:
    json.dump(res, outfile)