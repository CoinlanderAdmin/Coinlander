import secrets
import sha3
from Crypto.Hash import keccak
from eth_keys import keys
from web3 import Web3
import json, yaml
import time
import pprint 

# Instantiate the w3 interface via node connection 

instance = '1'

w3 = Web3(Web3.HTTPProvider("https://rinkeby.arbitrum.io/rpc"))

with open("local/addresses.json") as f: 
    addresses_json = json.load(f)
    seasonOneAddress = addresses_json[instance]['contracts']['seasonOne']
    seekersAddress = addresses_json[instance]['contracts']['seekers']
    vaultAddress = addresses_json[instance]['contracts']['vault']
    

with open("artifacts/contracts/SeasonOne.sol/SeasonOne.json") as f:
  full_json = json.load(f)
  seasonOneABI = full_json['abi']

with open("artifacts/contracts/Seekers.sol/Seekers.json") as f:
  full_json = json.load(f)
  seekersABI = full_json['abi']

with open("artifacts/contracts/Vault.sol/Vault.json") as f:
  full_json = json.load(f)
  vaultABI = full_json['abi']

seasonOneContract = w3.eth.contract(address=seasonOneAddress, abi=seasonOneABI)
seekersContract = w3.eth.contract(address=seekersAddress, abi=seekersABI)
vaultContract = w3.eth.contract(address=vaultAddress, abi=vaultABI)

tx_hash = "0x69afcb03b9760201bb2ebadf69b0dbfb17d8db1098182e1e0a52a46a2dd2ac99"
receipt = w3.eth.getTransactionReceipt(tx_hash)
print(receipt)
# logs = seasonOneContract.events.Seized().processReceipt(receipt)
# print(logs)

# log_json = json.dumps(toDict(logs))
# print(log_json)
