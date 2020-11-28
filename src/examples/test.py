from requests import post
import time
import random

for i in range(1000):
    r = post('http://localhost:3000/invokeFunction', json={"funcName": "hellonode", "params":{}})
    print(r.status_code)

    time.sleep(random.randint(0,10)*0.03 + 0.1)