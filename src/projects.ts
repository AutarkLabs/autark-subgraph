import { json , ipfs, log, store, Value, BigInt, JSONValue, Bytes, Address, TypedMap } from "@graphprotocol/graph-ts"
import {
  Projects as Contract,
  RepoAdded,
  RepoRemoved,
  RepoUpdated,
  IssueUpdated,
  BountyRemoved,
  IssueCurated,
  BountySettingsChanged,
  AssignmentRequested,
  AssignmentApproved,
  AssignmentRejected,
  SubmissionAccepted,
  SubmissionRejected,
  AwaitingSubmissions,
  ScriptResult,
  RecoverToVault,
} from "../generated/Projects/Projects"
import { 
  Repo, 
  RepoData, 
  Issue, 
  IssueData, 
  Labels, 
  Author, 
  ProxyAddress, 
  FundingHistory, 
  User, 
  BountyIssue,
  Application,
  Review
} from "../generated/schema"
import { BountyIssued } from "../generated/StandardBounties/StandardBounties"

const ANY_ADDRESS = '0xffffffffffffffffffffffffffffffffffffffff'

export function handleRepoAdded(event: RepoAdded): void {
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type
  let repo = Repo.load(event.params.repoId.toHex())

  // Entities only exist after they have been saved to the store;
  // `null` checks allow to create entities on demand
  if (repo == null) {
    repo = new Repo(event.params.repoId.toHex())

    // Entity fields can be set using simple assignments
    // entity.count = BigInt.fromI32(0)
  }

  // BigInt and BigDecimal math are supported
  // entity.count = entity.count + BigInt.fromI32(1)

  // Entity fields can be set based on event parameters
  // entity.repoId = event.params.repoId
  // entity.index = event.params.index
  // entity.decoupled = event.params.decoupled
  repo.data = repo.id

  let contract = Contract.bind(event.address)
  // don't bother adding repo to store if it's been deleted
  if (!contract.isRepoAdded(event.params.repoId)) {
    return
  }
  let repoContractData = contract.getRepo(event.params.repoId)

  let data = RepoData.load(event.params.repoId.toHex())
  if (data == null) {
    data = new RepoData(event.params.repoId.toHex())
  }
  if (!event.params.decoupled) {
    data._repo = event.params.repoId.toString()
  } else {
    data._repo = event.params.repoId.toHexString()
  }
  data.openIssueCount = repoContractData.value1
  data.decoupled = event.params.decoupled
  data.repoData = repoContractData.value3
  //data.repo = event.params.repoId.toHex()
  //if (entity.decoupled) {
  //  const test = ipfs.cat(entity.dataHash)
  //  if (test != null) {
  //    log.info('IPFS success: {}', [test.toString()])
  //    //entity.
  //  }
  //}
  // Entities can be written to the store with `.save()`
  repo.save()
  data.save()
  // Note: If a handler doesn't require existing field values, it is faster
  // _not_ to load the entity from the store. Instead, create it fresh with
  // `new Entity(...)`, set the fields that should be updated and save the
  // entity back to the store. Fields that were not set or unset remain
  // unchanged, allowing for partial updates to be applied.

  // It is also possible to access smart contracts from mappings. For
  // example, the contract that has emitted the event can be connected to
  // with:
  //
  // let contract = Contract.bind(event.address)
}

export function handleRepoRemoved(event: RepoRemoved): void {
  let entity = Repo.load(event.params.repoId.toHex())

  // Entities only exist after they have been saved to the store;
  // `null` checks allow to create entities on demand
  if (entity != null) {
    store.remove('Repo', event.params.repoId.toHex())
    store.remove('RepoData', event.params.repoId.toHex())
    // Entity fields can be set using simple assignments
    // entity.count = BigInt.fromI32(0)
  }
}

export function handleRepoUpdated(event: RepoUpdated): void {
  let repoData = RepoData.load(event.params.repoId.toHex())
  if (repoData != null) {
    repoData.repoData = event.params.repoData
    repoData.save()

  }
}

export function handleIssueUpdated(event: IssueUpdated): void {
  let contract = Contract.bind(event.address)
  if (!contract.isRepoAdded(event.params.repoId)) {
    return
  }
  let repoDecoupled = RepoData.load(event.params.repoId.toHex()).decoupled
  
  let issueId = event.params.repoId.toHexString() + '_' + event.params.issueNumber.toString()
  let issueData = IssueData.load(issueId)
  if (issueData == null) {
    let issue = new Issue(issueId)
    issueData = new IssueData(issueId)
    issue.data = issueId
    issue.issueNumber = event.params.issueNumber.toString()
    issue.save()
  }
  issueData.number = event.params.issueNumber
  issueData.repoHexId = event.params.repoId.toHexString()
  if (repoDecoupled) {
    issueData.repoId = event.params.repoId.toHexString()
    issueData.repository = issueData.repoHexId
    issueData.labels = newLabels()
  } else {
    issueData.repoId = event.params.repoId.toString()
  }
  let issueContractdata = contract.getIssue(event.params.repoId, event.params.issueNumber)

  issueData.fulfilled = issueContractdata.value1
  issueData.balance = issueContractdata.value2
  issueData.hasBounty = issueData.balance > BigInt.fromI32(0)
  issueData.assignee = issueContractdata.value3
  issueData.openSubmission = issueData.assignee.toHex() == ANY_ADDRESS
  log.info('IPFS CID: {}', [event.params.ipfsHash])
  let test =  ipfs.cat(event.params.ipfsHash)
  if (test != null) {
    log.info('IPFS success: {}', [test.toString()])
    let ipfsObj = json.fromBytes(test as Bytes).toObject()
    if (repoDecoupled) {
      issueData.title = ipfsObj.get('title').toString()
      issueData.description = ipfsObj.get('body').toString()
      let login = ipfsObj.get('author').toObject().get('login').toString()
      log.info('login: {}', [login])
      issueData.author = newAuthor(login)
      issueData.createdAt = ipfsObj.get('createdAt').toString()
      issueData.issueId = issueData.id
      issueData.state = 'OPEN'
      issueData.url = ''
    } else {
      issueData.issueId = ipfsObj.get('issueId').toString()
    }
    if (issueData.hasBounty) {
      //let bounties = StandardBounties.bind(contract.bountiesRegistry())
      //let bountiesData = bounties.getBounty(issueContractdata.value0)
      //log.info('bounty token address: {}', [bountiesData.token.toHex()])
      issueData.workStatus = 'funded'
      issueData.token = Address.fromHexString(
        ipfsObj.get('token').toObject().get('addr').toString()
      ) as Bytes
      issueData.standardBountyId = issueContractdata.value0
      issueData.deadline = ipfsObj.get('deadline').toString()
      issueData.fundingHistories = []
      getBountyIssue(issueData.standardBountyId.toString(), issueId)
      getFundingHistory(issueData as IssueData, ipfsObj.get('fundingHistory').toArray())
      //log.info('funding histories: {}',[issueData.fundingHistories.length.toString()])
      //log.info('funding histories: {}',[getFundingHistory(issueId, ipfsObj.get('fundingHistory').toArray()).toString()])
      //issueData.fundingHistory = histories
      log.info('about to save: {}',[issueData.fundingHistories.toString()])
    }
  }
  issueData.save()
}

function getBountyIssue(bountyId: string, issueId: string): void {
  let bounty = BountyIssue.load(bountyId)
  if (bounty == null) {
    bounty = new BountyIssue(bountyId)
    bounty.data = issueId
    bounty.save()
  }
}

function getFundingHistory(issueData: IssueData, history: JSONValue[]): void {
  let eventIds = issueData.fundingHistories
  let issueId = issueData.id
  log.info('pre-Event ID: {}',[issueId])
  for (let index = 0; index < history.length; index++) {
    log.info('loop {} {}', [index.toString(), issueId])
    let eventObj = history[index].toObject()
    let eventId = issueId + '_' + index.toString()
    let event = FundingHistory.load(eventId)
    if (event == null){
      event = new FundingHistory(eventId)
      event.user = newUser(eventObj.get('user').toObject())
      event.date = eventObj.get('date').toString()
      event.description = eventObj.get('description').toString()
      event.save()
      // I don't completely understand this sequence but this is how they do it in their example repos
      eventIds.push(eventId)
    }
  }
  issueData.fundingHistories = eventIds
  //log.info('event Ids saved',[])
  //issueData.save()
  //return eventIds as string
}



function newLabels(): string {
  let label = Labels.load('0')
  if (label == null) {
    label = new Labels('0')
    label.totalCount = BigInt.fromI32(0)
    label.edges = []
    label.save()
  }
  return '0'
}

function newAuthor(login: string): string {
  let author = Author.load(login)
  if (author == null) {
    author = new Author(login)
    author.avatarUrl = ''
    author.url = ''
    author.login = login
    author.save()
  }
  return login
}

export function newUser(userObj: TypedMap<string, JSONValue>, addrBackup: string = ''): string {
  let login = userObj.get('login').toString()
  let addrObj = userObj.get('addr')
  let addr: string
  if (addrObj.isNull()) {
    log.info('failed to access addr; using backup: {}', [addrBackup])
    addr = addrBackup
  } else {
    addr = addrObj.toString()
  }
  let id = login + '_' + addr 
  let user = User.load(id)
  if (user == null) {
    user = new User(id)
    user.avatarUrl = userObj.get('avatarUrl').toString()
    user.url = userObj.get('url').toString()
    user.login = login
    user.addr = Address.fromString(addr)
    user.save()
  }
  return id
}

export function handleBountyRemoved(event: BountyRemoved): void {}

export function handleIssueCurated(event: IssueCurated): void {}

export function handleBountySettingsChanged(
  event: BountySettingsChanged
): void {
  let proxy = ProxyAddress.load(event.address.toHex())
  if (proxy == null) {
    proxy = new ProxyAddress(event.address.toHex())
    proxy.save()
  }
}

export function handleAssignmentRequested(event: AssignmentRequested): void {
  let projects = Contract.bind(event.address)
  let appNo = projects.getApplicantsLength(
    event.params.repoId, 
    event.params.issueNumber
  ).minus(BigInt.fromI32(1))
  log.info('application number: {}',[appNo.toString()])

  let applicant = projects.getApplicant(event.params.repoId, event.params.issueNumber, appNo)
  let applicationCid = applicant.value1
  let applicationBytes = ipfs.cat(applicationCid)
  if (applicationBytes == null) {
    log.error('could not resolve IPFS CID {}', [applicationCid])
    return
  }
  let applicationJson = json.fromBytes(applicationBytes as Bytes).toObject()
  let issueId = event.params.repoId.toHexString() + '_' + event.params.issueNumber.toString()
  let applicationId = issueId + '_' + applicant.value0.toHex()
  let application = new Application(applicationId)
  application.idx = appNo
  application.contributorAddr = applicant.value0.toHex()
  application.requestIPFSHash = applicationCid
  application.workplan = applicationJson.get('workplan').toString()
  application.hours = applicationJson.get('hours').toString()
  application.eta = applicationJson.get('eta').toString()
  application.ack1 = true
  application.ack2 = true
  application.user = newUser(applicationJson.get('user').toObject())
  application.applicationDate = applicationJson.get('applicationDate').toString()
  application.save()
  let issueData = IssueData.load(issueId)
  if (issueData == null) {
    log.error('couldn\'t load issue for id: {}', [issueId])
    return
  }
  log.info('test {}', [issueId])
  let requests = issueData.requestsData
  if (requests == null) requests = []
  requests.push(applicationId)
  issueData.requestsData = requests
  issueData.workStatus = 'review-applicants'
  issueData.save()
}

export function handleAssignmentApproved(event: AssignmentApproved): void {
  let issueId = event.params.repoId.toHex() + '_' + event.params.issueNumber.toString()
  let appId = issueId + '_' + event.params.applicant.toHex()
  let applicant = Application.load(appId)
  if (applicant == null) {
    log.error('no application found for id: {}',[appId])
    return
  }
  let projects = Contract.bind(event.address)
  let ApplicationData = projects.getApplicant(
    event.params.repoId,
    event.params.issueNumber,
    applicant.idx
  )
  log.info('IPFS hash: {} ', [ApplicationData.value1])
  let applicationCid = ApplicationData.value1
  let applicationBytes = ipfs.cat(applicationCid)
  if (applicationBytes == null) {
    log.error('could not resolve IPFS CID {}', [applicationCid])
    return
  }
  applicant.requestIPFSHash = applicationCid
  let applicationJson = json.fromBytes(applicationBytes as Bytes).toObject()
  let reviewJson = applicationJson.get('review').toObject()
  let review = new Review(appId)
  review.feedback = reviewJson.get('feedback').toString()
  review.approved = reviewJson.get('approved').toBool()
  review.reviewDate = reviewJson.get('reviewDate').toString()
  review.user = newUser(reviewJson.get('user').toObject())
  review.save()
  applicant.review = appId
  applicant.save()

  let issueData = IssueData.load(issueId)
  if (issueData == null) {
    log.error('issue not found: {}', [issueId])
    return
  }
  issueData.workStatus = 'in-progress'
  issueData.assignee = ApplicationData.value0
  issueData.save()
}

export function handleAssignmentRejected(event: AssignmentRejected): void {
  let issueId = event.params.repoId.toHex() + '_' + event.params.issueNumber.toString()
  let appId = issueId + '_' + event.params.applicant.toHex()
  let applicant = Application.load(appId)
  if (applicant == null) {
    log.error('no application found for id: {}',[appId])
    return
  }
  let projects = Contract.bind(event.address)
  let ApplicationData = projects.getApplicant(
    event.params.repoId,
    event.params.issueNumber,
    applicant.idx
  )
  log.info('IPFS hash: {} ', [ApplicationData.value1])
  let applicationCid = ApplicationData.value1
  let applicationBytes = ipfs.cat(applicationCid)
  if (applicationBytes == null) {
    log.error('could not resolve IPFS CID {}', [applicationCid])
    return
  }
  applicant.requestIPFSHash = applicationCid
  let applicationJson = json.fromBytes(applicationBytes as Bytes).toObject()
  let reviewJson = applicationJson.get('review').toObject()
  let review = new Review(appId)
  review.feedback = reviewJson.get('feedback').toString()
  review.approved = reviewJson.get('approved').toBool()
  review.reviewDate = reviewJson.get('reviewDate').toString()
  review.user = newUser(reviewJson.get('user').toObject())
  review.save()
  applicant.review = appId
  applicant.save()
}

export function handleSubmissionAccepted(event: SubmissionAccepted): void {
  let issueId = event.params.repoId.toHex() + '_' + event.params.issueNumber.toString()
  let issueData = new IssueData(issueId)
  issueData.workStatus = 'fulfilled'
  issueData.save()
}

export function handleSubmissionRejected(event: SubmissionRejected): void {}

export function handleAwaitingSubmissions(event: AwaitingSubmissions): void {}

export function handleScriptResult(event: ScriptResult): void {}

export function handleRecoverToVault(event: RecoverToVault): void {}
