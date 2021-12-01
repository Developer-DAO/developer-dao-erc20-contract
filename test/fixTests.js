const { ethers } = require("hardhat")
const { MerkleTree } = require('merkletreejs')
const keccak256 = require('keccak256')
const { expect } = require("chai")

/* this is just test data */
/* snapshot will come from this code https://github.com/Developer-DAO/erc721-snapshot */
const leaves = [
  ["0xB2Ebc9b3a788aFB1E942eD65B59E9E49A1eE500D", 300], ["0x5eC5e26D5304EF62310b5bC46A150d15E144e122", 300], ["0xcc13187AfEf880894a8832b854eFE9816449BC59", 300], ["0x1d69d3CDEbB5c3E2B8b73cC4D49Aa145ecb7950F", 300], ["0xDc173B36003a886b3248650206A1fAE7433660A2", 300], ["0xcAa3a3c852442F06806170D137248bb21ddb0E1B", 300], ["0xd75135B26b1bC182266B2B22108Cc3cEF2c171D5", 300], ["0x75448866cEe7A4680dC58FE846446aF71F9f8438", 300], ["0xAD0e00593C796665b5B44Dc5410c906e09100a67", 300], ["0x7911670881A81F8410d06053d7B3c237cE77b9B4", 300], ["0xD02c0b401d1865e87bC4365B0a2621d7d8B78348", 300], ["0x786c9Fb9494Cc3c82d5a47A62b4392c7004106ca", 300], ["0xCe2F6F6a51F725049d7D56aB11C09A096360398a", 300], ["0x03f9bc4648a98CDc61FcA7a177D809edAB2c14fc", 300], ["0x27F8602E403B6EA18f8711A7858fa4a94ef3269b", 300], ["0xd6AB094FE02B9D2F5bE7F400D9A06717f95daE9E", 300], ["0x40F0A3fd9295e2a409F2512Fde438fe6ed8B5ec8", 300], ["0xA703B1cB89F50939173a124ba76571369cF69953", 300], ["0x184E2D53a04bC87A6b597703eDcD62d768DA1F27", 300], ["0xa4A13B3f22BC0e90235e17AE9343B2c7e04e96c8", 300], ["0x926b8edBef960305cBcAA839b1019c0a54358f2C", 300], ["0x6D95392544846c0cD6CcEc0342F24534d84393e7", 300],
  ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", 300], ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8", 500], ["0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", 300]
].map(v => ethers.utils.solidityKeccak256(['address', 'uint256'], [v[0], v[1]]))
const tree = new MerkleTree(leaves, keccak256, { sort: true })

/*
uint256 freeSupply,
uint256 airdropSupply,
uint256 _claimPeriodEnds
*/

let DevDaoContract;
let supply;
let airdropAmount;
let treasury;
let claimer1;
let claimer2;

describe("Developer DAO Token Contract Testing", function () {

  before(async () => {
    // token amounts TBD, these numbers are just for testing puropses
    supply = 10_000_000
    airdropAmount = 2_000_000
    const timestamp = 1640433346

    const accounts = await ethers.getSigners()

    treasury = accounts[0]
    claimer1 = accounts[1]
    claimer2 = accounts[2]

    const DD = await hre.ethers.getContractFactory("DeveloperDAOToken")
    DevDaoContract = await DD.deploy(supply, airdropAmount, timestamp)
    await DevDaoContract.deployed()
  })

  it("Reads values minted from deployment", async function () {

    console.log('treasury address: ', treasury.address)

    /* total supply */
    const totalSupply = await DevDaoContract.totalSupply()
    const expectedSupply = ethers.utils.parseEther((supply + airdropAmount).toString())
    expect(totalSupply).to.eq(expectedSupply)
    console.log('Supply: ', ethers.utils.formatEther(totalSupply))

    /* treasury balance */
    const treasBalance = await DevDaoContract.balanceOf(treasury.address)
    const expectedTreasBalance = ethers.utils.parseEther(supply.toString())
    expect(treasBalance).to.eq(expectedTreasBalance)
    console.log('Treasury balance:', ethers.utils.formatEther(treasBalance))

    /* contract balance */
    const contractBalance = await DevDaoContract.balanceOf(DevDaoContract.address)
    const expectedContractBalance = ethers.utils.parseEther(airdropAmount.toString())
    expect(contractBalance).to.eq(expectedContractBalance)
    console.log('Contract balance: ', ethers.utils.formatEther(contractBalance))
  })

  it("Sets the merkle root, should not allow to set again", async function () {
    const root = tree.getHexRoot()
    await DevDaoContract.setMerkleRoot(root)
    expect(DevDaoContract.setMerkleRoot(root)).to.be.reverted;
    contractRoot = await DevDaoContract.merkleRoot()
    console.log("Merkle Root in Contract: ", contractRoot)
  })

  it("Should allow a user to claim tokens", async function () {
    const leaf = ethers.utils.solidityKeccak256(['address', 'uint256'], [claimer1.address, 500])
    const proof = tree.getHexProof(leaf)

    await DevDaoContract.connect(claimer1).claimTokens(500, proof)
    const airdropPersonalAmount = ethers.utils.parseEther("500")

    /* Get claimer balance */
    let claimerBalance = await DevDaoContract.balanceOf(claimer1.address)
    expect(claimerBalance).to.equal(airdropPersonalAmount)
    console.log('Claimer balance: ', ethers.utils.formatEther(claimerBalance))

    /* log contract supply after first witdrawal */
    const contractBalance = await DevDaoContract.balanceOf(DevDaoContract.address)
    console.log('Contract balance: ', ethers.utils.formatEther(contractBalance))

    const balanceAfterOneDrop = ethers.utils.parseEther(airdropAmount.toString()).sub(airdropPersonalAmount)
    expect(contractBalance).to.equal(balanceAfterOneDrop)
  })

  it("Should not allow someone to claim twice", async function () {
    let error
    const leaf = ethers.utils.solidityKeccak256(['address', 'uint256'], [claimer1.address, 500])
    const proof = tree.getHexProof(leaf)


	/*Instead of the below try/catch structure, we will use mocha to.be.reverted. Now instead of throwing an error, the test will PASS.
   We want the test to pass because we are specifically checking FOR reversion. If the test doesn't pass, this is not good because it 
	means the transaction was not reverted. */

	expect(DevDaoContract.connect(claimer1).claimTokens(500,proof)).to.be.reverted

   //  try {
   //    await DevDaoContract.connect(claimer1).claimTokens(500, proof)
   //    error = true
   //  } catch (err) {}
   //  if (error) throw new Error("Should not allow someone to mint twice")
  })

  it("Should reject a false proof, using claimer1 proof for claimer2", async () => {
    let error
    const leaf = ethers.utils.solidityKeccak256(['address', 'uint256'], [claimer1.address, 500])
    const proof = tree.getHexProof(leaf)

	 expect(DevDaoContract.connect(claimer2).claimTokens(300, proof)).to.be.reverted
  })

  it("Should not allow the second account to claim a wrong amount of tokens even with a valid proof", async () => {
    let error
    const leaf = ethers.utils.solidityKeccak256(['address', 'uint256'], [claimer2.address, 300])
    const proof = tree.getHexProof(leaf)
	
	//valid proof but attempting to claim 800 instead of 300
	expect(DevDaoContract.connect(claimer2).claimTokens(800,proof)).to.be.reverted
  })

  it("Should allow the second account to claim the right amount of tokens", async () => {
    const leaf = ethers.utils.solidityKeccak256(['address', 'uint256'], [claimer2.address, 300])
    const proof = tree.getHexProof(leaf)

    await DevDaoContract.connect(claimer2).claimTokens(300, proof)

    const airdropPersonalAmount = ethers.utils.parseEther("300")
    const firstAirdropPersonalAmount = ethers.utils.parseEther("500")
    const twiceAirdropPersonalAmount = airdropPersonalAmount.add(firstAirdropPersonalAmount)

    /* Get claimer balance */
    let claimerBalance = await DevDaoContract.balanceOf(claimer2.address)
    expect(claimerBalance).to.equal(airdropPersonalAmount)
    console.log('Claimer balance: ', ethers.utils.formatEther(claimerBalance))

    /* log contract supply after first witdrawal */
    const contractBalance = await DevDaoContract.balanceOf(DevDaoContract.address)
    console.log('Contract balance: ', ethers.utils.formatEther(contractBalance))

    const balanceAfterTwoDrops = ethers.utils.parseEther(airdropAmount.toString()).sub(twiceAirdropPersonalAmount)
    expect(contractBalance).to.equal(balanceAfterTwoDrops)
  })

  it("Should allow the treasury to mint", async function () {

    /* treasury balance */
    const balance = await DevDaoContract.balanceOf(treasury.address)
    console.log('Treasury balance:', ethers.utils.formatEther(balance))

    /* mint more tokens */
    await DevDaoContract.connect(treasury).mint(1_000_000)
    const millionEther = ethers.utils.parseEther("1000000")
    const expectedValueAfter = balance.add(millionEther)
    expect(await DevDaoContract.balanceOf(treasury.address)).to.equal(expectedValueAfter)

    let treasuryBalance = await DevDaoContract.balanceOf(treasury.address)
    console.log('New treasury balance after additional mint: ', ethers.utils.formatEther(treasuryBalance))
  })

  it("Should not allow the treasury to mint after minting is disabled", async function () {
    let error
    const mint_tx = await DevDaoContract.connect(treasury).mint(1_000_000)
	 await mint_tx.wait(); 

    const tx = await DevDaoContract.connect(treasury).disableMinting()
	 await tx.wait();
	 expect(DevDaoContract.connect(treasury).mint(1_000_000)).to.be.reverted
  })
})