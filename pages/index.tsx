import {useEffect, useState} from 'react'
import {ethers, utils} from 'ethers'
import {coinOne, getImmortalNFT, rpcProvider} from 'utils/ethers'


export default function Home(){
    const [bounty, setBounty] = useState<string|null>(null)
    const [holder, setHolder] = useState<string|null>(null)

    const fetchData = async () => {
        const mss = utils.formatEther(await coinOne.minimumSeizureStake())
        const holder = await coinOne.holder()
        const nft = await getImmortalNFT()
      
        const totalSupply = await (await nft.totalSupply()).toNumber()
        if (totalSupply > 0) {
            const owners = await nft.allTokenOwners()
            console.log(owners)
        }
        setBounty(await mss.toString())
        setHolder(holder)
    }

    useEffect(() => {
        fetchData()
    },[])


    const steal = async () => {
        const provider = new ethers.providers.Web3Provider(window.ethereum)
        const coin = coinOne.connect(provider.getSigner())
        const mss = await coin.minimumSeizureStake()
        console.log(ethereum.selectedAddress)
        await coin.steal({
            value: mss,
        })
    }

    return <div>
        <div>
            <h3>Shrine</h3>
        </div>
        <div>
        <h1>Holder: {holder}</h1>

        <h2>Bounty: {bounty}</h2>
        <button onClick={async ()=>{
            steal()

        }}>Steal</button>
        </div>


        </div>
}


async function connectAccounts(){
    if (window.ethereum) {
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
    }
}