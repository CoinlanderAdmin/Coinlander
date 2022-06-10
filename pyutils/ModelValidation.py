import pandas as pd
import matplotlib.pyplot as plt

plt.rcParams["figure.figsize"] = [7.50, 3.50]
plt.rcParams["figure.autolayout"] = True

headers = ['Seizure','Eth','USD','Take','Refund','CumTake','ShardToEth','Prize','CumPrize']
modelDF = pd.read_csv('SeasonOneGameModel.csv', names=headers)

x = modelDF['Seizure']
y = modelDF['Eth']

plt.plot(x,y)
plt.savefig('test.png')