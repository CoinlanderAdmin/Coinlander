from PIL import Image
import sys, os, json
dataDir = 'local/data/'
imgsDir = 'local/imgs/'

cmap = {'0': (255,255,255),
        '1': (0,0,0)}
grid = 4 # 4x4 grid 

def convertToBin(decInput):
  scale = 10 ## equals to dec
  num_of_bits = 32
  return bin(int(decInput))[2:].zfill(num_of_bits)


for filename in os.listdir(dataDir):

  with open(dataDir + filename) as j: 
    jsonData = json.load(j)
  
  fullImg = Image.new('RGB', (32,32), "white")
  
  for i, intSegment in enumerate(jsonData):
    binSegment = convertToBin(intSegment)

    imgDataSegment = [cmap[letter] for letter in binSegment]
    imgSegment = Image.new('RGB', (32,1), "white")
    imgSegment.putdata(imgDataSegment)
    fullImg.paste(imgSegment, (0,i))

  
  fullImg.save(imgsDir + str(filename) + '.bmp')

def convertToBin(hexInput):
  scale = 16 ## equals to hexadecimal
  num_of_bits = 64
  bin(int(hexInput, scale))[2:].zfill(num_of_bits)
