import { BigInt, Bytes, ipfs, log, store, json, JSONValueKind } from "@graphprotocol/graph-ts"
import { 
  StandardBounties as Contract,
  BountyFulfilled,
  ActionPerformed,
  BountyIssued
} from "../generated/templates/StandardBounties/StandardBounties"
import { ProxyAddress, BountyIssue, IssueData, WorkSubmission, Review } from "../generated/schema"
import { newUser } from "./projects"

export function handleBountyFulfilled(event: BountyFulfilled): void {
  let bounty = BountyIssue.load(event.params._bountyId.toString())
  if (bounty == null) {
    // bounty id not tracked by our app
    return
  }
  log.info('submission caught! woohoo {}',[event.params._fulfillmentId.toString()])
  let data = IssueData.load(bounty.data)
  let fulfillmentData =  ipfs.cat(event.params._data)
  if (fulfillmentData == null) {
    log.error('IPFS failed to resolve fulfillment data: {}', [event.params._data.toString()])
    return
  }

  let fulfillmentJson = json.fromBytes(fulfillmentData as Bytes).toObject()

  let submissionId = event.params._bountyId.toString() + '_' + event.params._fulfillmentId.toString()
  let submission = new WorkSubmission(submissionId)
  submission.ack1 = true
  submission.ack2 = true
  submission.submissionDate = fulfillmentJson.get('submissionDate').toString()
  submission.hours = fulfillmentJson.get('hours').toString()
  submission.comments = fulfillmentJson.get('comments').toString()
  submission.proof = fulfillmentJson.get('proof').toString()
  submission.submissionIPFSHash = event.params._data.toString()
  submission.submitter = event.params._submitter as Bytes
  submission.fufillers = event.params._fulfillers as Bytes[]
  submission.fulfillmentId = event.params._fulfillmentId.toString()

  let submitterLogin = fulfillmentJson.get('user').toObject()
  submission.user = newUser(submitterLogin, event.params._submitter.toHexString())

  submission.save()

  let workSubmissions = data.workSubmissions
  if (workSubmissions == null) {
    workSubmissions = []
  }

  workSubmissions.push(submissionId)
  data.workSubmissions = workSubmissions
  data.work = submissionId
  data.workStatus = 'review_work'
  data.save()
}

export function handleActionPerformed(event: ActionPerformed): void {
  let bountyIssue = BountyIssue.load(event.params._bountyId.toString())
  if (bountyIssue == null) return

  let submissionBytes = ipfs.cat(event.params._data) //evet.params._data
  if (submissionBytes == null) return
  let submissionJson = json.fromBytes(submissionBytes as Bytes).toObject()
  let reviewBytes = submissionJson.get('review')
  if (reviewBytes.isNull()) {
    log.info('no review found for CID: {}', [event.params._data])
    return
  }
  let proof = submissionJson.get('proof')
  if (proof.isNull()) {
    log.info('Not a submission review, exiting', [])
    return
  }
  log.info('submission: {}', [submissionBytes.toString()])
  log.info('submission data: {}', [submissionJson.get('fulfillmentId').toString()])
  //let fulId = submissionJson.get("contributorAddr").toString()
  //log.info('submission: {}', [fulId])
  let reviewObj = reviewBytes.toObject()
  let submissionId = event.params._bountyId.toString() + '_' + submissionJson.get('fulfillmentId').toString()
  let submission = new WorkSubmission(submissionId)
  let review = new Review(submissionId)
  review.feedback = reviewObj.get('feedback').toString()
  review.rating = reviewObj.get('rating').toBigInt()
  review.reviewDate = reviewObj.get('reviewDate').toString()
  review.accepted = reviewObj.get('accepted').toBool()
  review.user = newUser(reviewObj.get('user').toObject())
  submission.review = submissionId
  submission.save()
  review.save()  
}

export function handleBountyIssued(event: BountyIssued): void {
  let trackedProxy = ProxyAddress.load(event.params._sender.toHex())
  log.info('Bounty Issued Successfully',[])
  if(trackedProxy != null) {
    log.info('found tracked event',[])
    let bountyData = ipfs.cat(event.params._data)
    if (bountyData == null) {
      log.error('ipfs could not resolve CID: {}', [event.params._data])
    }
    log.info('found data: {}', [bountyData.toString()])
  }
}
