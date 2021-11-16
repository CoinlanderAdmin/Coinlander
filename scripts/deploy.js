// This is a script for deploying the contracts and creating artifacts/abi jsons for the react frontend
// Currently does not run due to a ts error

async function main() {
    // This is just a convenience check
    if (network.name === "hardhat") {
      console.warn(
        "You are trying to deploy a contract to the Hardhat Network, which" +
          "gets automatically created and destroyed every time. Use the Hardhat" +
          " option '--network localhost'"
      );
    }
  
    // ethers is avaialble in the global scope
    const [deployer] = await ethers.getSigners();
    console.log(
      "Deploying the contracts with the account:",
      await deployer.getAddress()
    );
  
    console.log("Account balance:", (await deployer.getBalance()).toString());
  
    const Immortals = await ethers.getContractFactory("Immortals");
    const immortals = await Immortals.deploy();
    await immortals.deployed();

    console.log("Immortals address:", immortals.address);

    const CoinOne = await ethers.getContractFactory("CoinOne");
    const coinOne = await CoinOne.deploy();
    await coinOne.deployed();
  
    console.log("One Coin address:", coinOne.address);
  
    // We also save the contract's artifacts and address in the frontend directory
    saveFrontendFiles(coinOne);
    saveFrontendFiles(immortals);
  }
  
  function saveFrontendFiles(token) {
    const fs = require("fs");
    const contractsDir = __dirname + "/../../CoinApp/src/contracts";
  
    if (!fs.existsSync(contractsDir)) {
      fs.mkdirSync(contractsDir);
    }
  
    fs.writeFileSync(
      contractsDir + "/contract-addresses.json",
      JSON.stringify({ Immortals: immortals.address }, undefined, 2),
      JSON.stringify({ CoinOne: coinOne.address }, undefined, 2)
    );
  
    const ImmortalsArtifact = artifacts.readArtifactSync("Immortals");

    fs.writeFileSync(
        contractsDir + "/Immortals.json",
        JSON.stringify(ImmortalsArtifact, null, 2)
    );

    const CoinOneArtifact = artifacts.readArtifactSync("CoinOne");
  
    fs.writeFileSync(
      contractsDir + "/CoinOne.json",
      JSON.stringify(CoinOneArtifact, null, 2)
    );

  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  