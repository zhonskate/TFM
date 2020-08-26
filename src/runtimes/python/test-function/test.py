import dice
import sys
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