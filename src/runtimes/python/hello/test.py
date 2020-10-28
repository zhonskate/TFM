import sys
import json

roll = []

with open('input.json') as jsonFile:
    data = json.load(jsonFile)

res = {}
res['output'] = 'world'

with open('output.json', 'w') as outfile:
    json.dump(res, outfile)