/** @param {NS} ns **/
//Script written my Plontz while using some functionality & scripts from jrpl on Github
//credit: https://github.com/Jrpl/Bitburner-Scripts
//provide an argument while launching to reserve ram on your
//home machine for this script to not utilize
import { multiscan, gainRootAccess } from "utils.js";

//filter all servers that have money & are currently hackable,
//then find the one that has the most money
async function sort(ns, arr) {
  //func used in sorting algorithm
  function format(ns, arr, elem) {
    let newarr = [];
    newarr.push(arr[elem]);
    arr.forEach(server => {
      if (!newarr.includes(server)) {
        newarr.push(server);
      }
    }
    )
    return newarr;
  }

  //*******************begin formating & sorting********************//
  let ServList = [];

  //filter to only possess servers with money that aren't my servers within the list
  arr.forEach(server => {
    if (!ns.hasRootAccess(server)) {
      gainRootAccess(ns, server);
    }
    if (ns.hasRootAccess(server) &&
      ns.getServerRequiredHackingLevel(server) <= ns.getHackingLevel() &&
      server != 'home' &&
      !ns.getPurchasedServers().includes(server) &&
      //modified this from the original, slightly.
      //without "==0", a server having $0 was still included
      !ns.getServerMoneyAvailable(server) == 0) {

      ServList.push(server);
    }
  })

  //sorting algorithm:
  //skip first entry, if current entry has more $ capacity than previous entry, remake array
  //with current entry at first position and restart sort
  for (let i = 0; i < ServList.length; i++) {
    if (i == 0) {
      continue;
    }
    if (ns.getServerMaxMoney(ServList[i]) > ns.getServerMaxMoney(ServList[i - 1])) {
      ServList = format(ns, ServList, i);
      i = 0;
      continue;
    }
  }
  ServList.forEach(server =>
    ns.write("/home/test.txt", server.hostname))
  return ServList;
}



export async function main(ns) {
  ns.disableLog("ALL");
  ns.enableLog("print");
  ns.tail();
  let reservedRAM = ns.args[0];
  if (reservedRAM == null) {
    reservedRAM = 0;
  }
  //declare values to be modified within loop, but is used outside of loop
  let Loop = 0
  let Cycle = 0;
  while (true) {
    ns.toast("Begin new hack cycle", "info", 2500);
    //have this run every cycle to always be targetting the highest worth server
    let ServerList = await sort(ns, multiscan(ns, "home"));
    const Target = ServerList[0];
    ns.print("Target: " + Target);

    //time math 
    const growTime = ns.getGrowTime(Target);
    const hackTime = ns.getHackTime(Target);
    const weakTime = ns.getWeakenTime(Target);

    const growExecTime = weakTime - growTime + 20;
    const hackExecTime = weakTime - hackTime + 20;

    Cycle = (weakTime + 30);

    //make sure target is at minSec and maxMoney
    if (ns.getServerMaxMoney(Target) != ns.getServerMoneyAvailable(Target)) {
      ns.write("/home/hackLog.txt", "Loop Number: " + Loop.toString() + "includes a grow cycle.\n");

      const growThreads = Math.ceil(ns.growthAnalyze(Target, (ns.getServerMaxMoney(Target) / ns.getServerMoneyAvailable(Target))));
      const weakenThreadsG = 1;
      while (Math.ceil(ns.growthAnalyzeSecurity(growThreads, Target)) > weakenAnalyze(weakenThreadsG)) {
        weakenThreadsG += 3;
        await ns.sleep(1)
      }
      const growTime = ns.getGrowTime(Target);
      const weakTime = ns.getWeakenTime(Target);
      const growExecTime = weakTime - growTime + 20;

      ns.exec("Scriptedgrow.js", growThreads, growExecTime, Target);
      ns.exec("ScriptedWeaken.js", weakenThreadsG, Target);
      ns.sleep(Cycle);
      continue;
    }

    //get all pservs to always have up to date info on RAM capacity/num of servers if early game 
    let HostServs = ["home"];
    ns.getPurchasedServers().forEach(serv => {
      HostServs.push(serv);
    })
    ns.print("Length: " + HostServs.length)


    //threads math
    let growThreads = Math.ceil(ns.growthAnalyze(Target, 2));
    let hackThreads = Math.ceil(ns.hackAnalyzeThreads(Target, ns.getServerMoneyAvailable(Target) / 2));
    let secIncreaseH = Math.ceil(ns.hackAnalyzeSecurity(hackThreads, Target));
    let secIncreaseG = Math.ceil(ns.growthAnalyzeSecurity(growThreads, Target));
    let weakenThreadsH = 1;//to counter hack
    let weakenThreadsG = 1;//to counter grow

    while (ns.weakenAnalyze(weakenThreadsH) < secIncreaseH * 1.1) {
      weakenThreadsH += 3;
      await ns.sleep(1);
    }
    while (ns.weakenAnalyze(weakenThreadsG) < secIncreaseG * 1.1) {
      weakenThreadsG += 3;
      await ns.sleep(1);
    }

    //ram needed to run all 4 scripts at thread count
    const requiredRAM = (ns.getScriptRam("ScriptedHack.js")*hackThreads +
      ns.getScriptRam("ScriptedWeaken.js")*weakenThreadsH +
      ns.getScriptRam("ScriptedGrow.js")*growThreads +
      ns.getScriptRam("ScriptedWeaken.js")*weakenThreadsG);
    ns.print("Req RAM: " + requiredRAM);

    //error detection
    if (hackThreads < 1 || weakenThreadsG < 1 || weakenThreadsH < 1 || growThreads < 1) {
      ns.toast("Error in Hack Manager!", "error", 5000);
      ns.print("Uh oh! something broke!");
      ns.print("hack threads: " + hackThreads);
      ns.print("WeakenH threads: " + weakenThreadsH);
      ns.print("WeakenG threads: " + weakenThreadsG);
      ns.print("grow threads: " + growThreads);
      ns.exit();
    }
    if (weakTime < growTime || weakTime < hackTime) {
      ns.toast("Error in Hack Manager!", "error", 5000);
      ns.print("weaken is not always the longest, write more contingencies");
      ns.exit();
    }
    if ((weakTime - growTime) + 20 < 0 || (weakTime - hackTime) + 20 < 0) {
      ns.toast("Error in Hack Manager!", "error", 5000);
      ns.print("rethink time calculations");
      ns.print("weakTime: " + weakTime);
      ns.print("hackTime: " + hackTime);
      ns.print("growTime: " + growTime);
      ns.exit;
    }

    //logging
    ns.write("/home/hackLog.txt", "Loop Number: " + Loop.toString() + "\n");
    ns.write("/home/hackLog.txt", "Target: " + Target + "\n");
    ns.write("/home/hackLog.txt", "Target Maximum Cash Avaliable: " + ns.getServerMoneyAvailable(Target) + "\n");
    ns.write("/home/hackLog.txt", "Target Current Cash Avaliable: " + ns.getServerMoneyAvailable(Target) + "\n");
    ns.write("/home/hackLog.txt", "Target Minimum Security Level: " + ns.getServerMinSecurityLevel(Target) + "\n");
    ns.write("/home/hackLog.txt", "Target Current Security Level: " + ns.getServerSecurityLevel(Target) + "\n");
    ns.write("/home/hackLog.txt", "\n");
    
    //execution loop
    for (let i = 0; i < HostServs.length; i++) {
      //if on home, consider reserved RAM
      if (HostServs[i] == 'home') {
        while (ns.getServerMaxRam(HostServs[i]) - ns.getServerUsedRam(HostServs[i]) - reservedRAM > requiredRAM) {
          ns.exec("ScriptedHack.js", hackThreads, hackExecTime, Target);
          ns.exec("ScriptedWeaken.js", weakenThreadsH, Target);
          ns.exec("Scriptedgrow.js", growThreads, growExecTime, Target);
          ns.exec("ScriptedWeaken.js", weakenThreadsG, Target);
          ns.print("Beginning new cycle"); //will only execute once - only one home
        }
      }
      //if not on home, disregard reserved RAM
      if (HostServs[i] != 'home') {
        while (ns.getServerMaxRam(HostServs[i]) - ns.getServerUsedRam(HostServs[i]) > requiredRAM) {
          ns.exec("ScriptedHack.js", hackThreads, hackExecTime, Target);
          ns.exec("ScriptedWeaken.js", weakenThreadsH, Target);
          ns.exec("Scriptedgrow.js", growThreads, growExecTime, Target);
          ns.exec("ScriptedWeaken.js", weakenThreadsG, Target);
        }
      }
      //sleep for the amount of time it will take for all code to execute
      //before attempting to run more code
      ns.print("Ending Loop "+Loop)
      Loop += 1;
      await ns.sleep(Cycle);
    }
  }
}
