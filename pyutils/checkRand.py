import sys, os, json
import matplotlib.pyplot as plt 
import pandas as pd

dataDir = 'local/data/'
dataFilename = 'local/data/dist.json'

with open(dataFilename) as j:
  jsonData = json.loads(j.read())

allDist = []
print(jsonData)
for i in jsonData:
  print(jsonData[i])
  print(jsonData[i]['aps'])
  for j in jsonData[i]['aps']: 
    allDist.append(j)
  print(i)
  print('')  

plt.figure()
plt.hist(allDist)
plt.xticks([0,5,10,15,20])
plt.savefig('dist.png')