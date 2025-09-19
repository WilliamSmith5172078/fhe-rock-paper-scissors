const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const CloudFHE = await ethers.getContractFactory("CloudFHE");
  const cloudFHE = await CloudFHE.deploy();

  await cloudFHE.deployed();

  console.log("CloudFHE deployed to:", cloudFHE.address);
  console.log("Set REACT_APP_CLOUDFHE_ADDR=" + cloudFHE.address + " in your frontend .env file");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
