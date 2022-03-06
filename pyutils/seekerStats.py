import sys, os, json
import matplotlib.pyplot as plt 
import pandas as pd

dataDir = 'local/data/'
dataFilename = 'local/data/attributes.json'

with open(dataFilename) as j:
  jsonData = json.loads(j.read())

allAps = []
allAlignments = []
print(jsonData)
for i in jsonData:
  print(jsonData[i])
  print(jsonData[i]['aps'])
  for j in jsonData[i]['aps']: 
    allAps.append(j)
  allAlignments.append(jsonData[i]['alignment'])  
  print(i)
  print('')  

plt.figure()
plt.hist(allAps)
plt.savefig('APs.png')

plt.figure()
plt.hist(allAlignments)
plt.xticks(rotation=15)
plt.savefig('Alignments.png')