import { 
  json,
  ipfs,
  log,
  store,
  Value,
  BigInt,
  JSONValue,
  Bytes,
  Address,
  TypedMap
} from "@graphprotocol/graph-ts"

import { DeployToken, InstalledApp } from "../generated/OETemplate/Template"
import { ProxyAddress, Vault, NewToken, DaoToken, DaoTokenList } from "../generated/schema"
import { Projects, Vault as VaultTemplate } from "../generated/templates"
import { TokenManager } from "../generated/OETemplate/TokenManager"
import { Token } from "../generated/OETemplate/Token"
import { Vault as VaultContract } from "../generated/OETemplate/Vault"

const ETHER_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000"

const ADDRESS_BOOK_APP_ID = "0x32ec8cc9f3136797e0ae30e7bf3740905b0417b81ff6d4a74f6100f9037425de"
const ALLOCATIONS_APP_ID = "0x370ef8036e8769f293a3d9c1362d0e21bdfa4e0465d2cd9cf196ebd4ba75aa8b"
const DISCUSSIONS_APP_ID = "0xf8c9b8210902c14e71192ea564edd090c1659cbef1384e362fb508d396d72a38"
const DOT_VOTING_APP_ID = "0x6bf2b7dbfbb51844d0d6fdc211b014638011261157487ccfef5c2e4fb26b1d7e"
const PROJECTS_APP_ID = "0xac5c7cc8f4ed07bb3543b5a4152c4f1a045e1be68bd86e2cf6720b680d1d14f3"
const REWARDS_APP_ID = "0x3ca69801a60916e9222ceb2fa3089b3f66b4e1b3fc49f4a562043d9ec1e5a00b"
const VAULT_APP_ID = "0x7e852e0fcfce6551c13800f1e7476f982525c2b5277ba14b24339c68416336d1"
const VOTING_APP_ID = "0x9fa3927f639745e587912d4b0fea7ef9013bf93fb907d29faeab57417ba6e1d4"
const FINANCE_APP_ID = "0xbf8491150dafc5dcaee5b861414dca922de09ccffa344964ae167212e8c673ae"
const TOKEN_MANAGER_APP_ID = "0x6b20a3010614eeebf2138ccec99f028a61c811b3b1a3343b6ff635985c75c91f"
const EXPERIMENTAL_TOKEN_MANAGER_APP_ID = "0xc568f11b5218b4d75fdc69c471ebdcffcb59025cc9119abfb35ed6d0efcbc4ff"
const WHITELIST_ORACLE_APP_ID = "0x32ceb944f61770acf9d24fe42fd7ad630d08049a3b80b1475b120ab23569ba92"


export function handleDeployToken(event: DeployToken): void {
  let token = Token.bind(event.params.token)
  let transfers = token.transfersEnabled()
  if (transfers) {
    log.info('transfers enabled! ',[])
  } else {
    log.info('transfers disabled! ',[])
  }
}

export function handleInstalledApp(event: InstalledApp): void {
  log.info('app installed: {} \nat address: {}',[event.params.appId.toHex(),event.params.appProxy.toHex()])
  
  if (event.params.appId.toHex() == PROJECTS_APP_ID) {
    log.info('Projects caught!',[])
    Projects.create(event.params.appProxy)
  }
  else if (event.params.appId.toHex() == VAULT_APP_ID) {
    log.info('Vault Caught!',[])
    let proxy = new ProxyAddress(event.params.appProxy.toHex())
    let vaultContract = VaultContract.bind(event.params.appProxy)
    let daoAddress = vaultContract.kernel()
    let vault = new Vault(daoAddress.toHex())
    vault.addr = event.params.appProxy
    proxy.save()
    vault.save()
    let etherTokenId = daoAddress.toHex() + '_' + ETHER_TOKEN_ADDRESS
    let etherToken = new DaoToken(etherTokenId)
    etherToken.addr = Address.fromString(ETHER_TOKEN_ADDRESS) as Bytes
    etherToken.balance = vaultContract.balance(Address.fromString(ETHER_TOKEN_ADDRESS))
    etherToken.kernel = daoAddress
    etherToken.decimals = '18'
    etherToken.symbol = 'ETH'
    etherToken.isMinime = false
    etherToken.save()
    
    VaultTemplate.create(event.params.appProxy)
  } else if (
    event.params.appId.toHex() == TOKEN_MANAGER_APP_ID ||
    event.params.appId.toHex() == EXPERIMENTAL_TOKEN_MANAGER_APP_ID
  ) {
    let manager = TokenManager.bind(event.params.appProxy)
    let tokenAddress = manager.token()
    log.info('managing token: {}', [tokenAddress.toHex()])
    let tokenContract = Token.bind(tokenAddress)
    let daoAddress = manager.kernel()
    let tokenInfo = NewToken.load(tokenAddress.toHex())
    if (tokenInfo == null) {
      tokenInfo = new NewToken(tokenAddress.toHex())
      tokenInfo.addr = tokenAddress as Bytes
      
      tokenInfo.symbol = tokenContract.symbol()
      let decimals = tokenContract.decimals()
      tokenInfo.decimals = decimals.toString()
      tokenInfo.isMinime = true

      tokenInfo.save()
    }
    let tokenId = daoAddress.toHex() + '_' + tokenAddress.toHex()
    let daoToken = new DaoToken(tokenId)
    daoToken.addr = tokenAddress
    daoToken.kernel = daoAddress as Bytes
    daoToken.symbol = tokenInfo.symbol
    daoToken.decimals = tokenInfo.symbol
    daoToken.balance = BigInt.fromI32(0)
    daoToken.isMinime = tokenInfo.isMinime

    let vault = Vault.load(daoAddress.toHex())
    if (vault != null) {
      let vaultAddress = Address.fromString(vault.addr.toHex())
      daoToken.balance = tokenContract.balanceOf(vaultAddress)
    }

    daoToken.save()

    let tokenList = DaoTokenList.load(daoAddress.toHex())
    if (tokenList == null) {
      tokenList = new DaoTokenList(daoAddress.toHex())
      tokenList.list = []
    }
    let list = tokenList.list
    list.push(tokenId)
    tokenList.list = list
    tokenList.save()
  }
}
