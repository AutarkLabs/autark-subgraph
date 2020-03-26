# Autark Subgraph
Autark is a suite of apps built to facilitate collaboration, communication and resource-sharing for organizations and communities of any size or shape

This subgraph currently composes projects state on a local aragon devchain and makes it available via a graphQL service. In the future, this subgraph will track all state for all Autark orgs on local, rinkeby and mainnet ethereum chains. 

## Getting Started on local development
1. Run 
    ```bash
    $ npm i -g graph
    ```

2. Then run: 
    ```bash
    $ aragon devchain -i 92705506
    ```
    Specifying the network id is important when stopping and starting your stack, since an initialized graph node indexes on a specific network id, and subsequent restarts with existing state will fail if the devchain's netowork id changes.

3. If you haven't already, clone the [graph node](https://github.com/graphprotocol/graph-node) repo:
    ```bash
    $ cd .. && git clone https://github.com/graphprotocol/graph-node.git
    ```
    Follow the instructions for setting up a local graph node [here](https://thegraph.com/docs/quick-start#local-development). Your mileage may vary depending on how your IPFS node is configured, and you may want to customize the graph node's initialization flags to point to a specific IPFS node or a local node you have already set up. Our apps point to a remote IPFS node located at https://ipfs.autark.xyz:5001 so you might want to add a flag for that endpoint. to make local development as smooth as possible. Otherwise the graph node will have trouble resolving IPFS hashes.

4. In another terminal in the autark-graph project root directory: 
    ```bash
    $ npm i && npm run codegen
    ```
    Each time the subgraph manifest graphql schema is modified, rerun `codegen` as needed.
5. Finally, in a second terminal:
    ```bash
    $ npm run create-local && npm run deploy-local-watch
    ```
    This will autocompile and attempt to redeploy on all saves, check the graph node logs to see if there are any runtime errors in your mappings after each deploy.

## Example Queries
```graphql
{
  repo (id: "0x4d4445774f6c4a6c6347397a61585276636e6b784d6a59344f546b784e444d3d") {
    id
    data {
      _repo
      decoupled
      openIssueCount
      repoData
    }
  }
  repos {
    repoid: id
    data {
      _repo
      decoupled
      openIssueCount
      repoData
    }
  }
  issueDatas {
    id
    token
    standardBountyId
    fulfilled
    hasBounty
    balance
    openSubmission
    assignee
    repoHexId
    title
    description
    repository {
      decoupled
    }
    requestsData {
      idx
      contributorAddr
      workplan
    }
    workSubmissions {
      id
      fulfillmentId
      proof
      review {
        feedback
      }
    }
  }
  
  repoDatas (where: {index: "1"}) {
   _repo 
  }
}
```
