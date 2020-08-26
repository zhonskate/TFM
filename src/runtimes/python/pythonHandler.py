#!/usr/bin/python

import sys
import subprocess

if len(sys.argv) != 3 or sys.argv[1] is 'help':
    print('python3 pythonHandler.py test.py <REQUIREMENTS FILE>')
    exit(0)

codeFile = sys.argv[1]
reqFile = sys.argv[2]

print('installing dependencies...')
bashCommand = f"pip3 install -r {reqFile}"
process = subprocess.Popen(bashCommand.split(), stdout=subprocess.PIPE)
output, error = process.communicate()

f=open(codeFile, "r")

code =f.read()

print(code)

exec(code)