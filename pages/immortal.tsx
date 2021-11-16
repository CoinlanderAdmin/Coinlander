import {useEffect, useState} from 'react'
import {ethers, utils} from 'ethers'
import {coinOne, getImmortalNFT, rpcProvider} from 'utils/ethers'
import { CoinOne, CoinOneNFT } from "typechain"
import CoinOneNFTJson from "artifacts/contracts/CoinOne.sol/CoinOneNFT.json";



export default function Immortal(){
    const [name, setName] = useState<string>('')
    const [link, setLink] = useState<string>('')


    const init = async () => {

    }

    useEffect(() => {
        init()
    },[])


    const updateProfile = async () => {
        const provider = new ethers.providers.Web3Provider(window.ethereum)
        const nonce = await getNonce()
        console.log(nonce)
        const token = await provider.getSigner().signMessage(nonce)
        console.log('token', token)
        await fetch(`/api/v1/users/${ethereum.selectedAddress}`, {
            headers: {
                'Content-Type': 'application/json',
                'CoinOneToken': token
            },
            method: 'PUT',
            body: JSON.stringify({
                name,
                link
            })
        })
    }

    return <div>
        <input type={'name'} placeholder={'name'} value={name} onChange={({target: {value}}) => setName(value)}/>
        <input type={'link'} placeholder={'link'} value={link} onChange={({target: {value}}) => setLink(value)}/>

        <button onClick={updateProfile}>Update</button>
        </div>
}


const getNonce = async () => {
    const resp = await fetch(`/api/v1/users/${ethereum.selectedAddress}/nonce`)
    const {nonce} = await resp.json()
    return String(nonce)
}