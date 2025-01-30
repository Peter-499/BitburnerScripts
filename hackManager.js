/** @param {NS} ns **/
//Script written my Plontz while using some functionality & scripts from jrpl on Github
//credit: https://github.com/Jrpl/Bitburner-Scripts
//provide an argument while launching to reserve ram on your
//home machine for this script to not utilize
import { multiscan, gainRootAccess } from "utils.js";

//filter all servers that have money & are currently hackable,
//then find the one that has the most money
function sort(ns, arr) {
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
  ns.clearLog();
  ns.tail();
  let reservedRAM = ns.args[0];
  if (reservedRAM == null) {
    reservedRAM = 0;
  }
  //declare values to be modified within loop, but is used outside of loop
  let Loop = 0
  let Cycle = 0;
  while (true) {
    ns.toast("Begin new hack cycle", "info", 3000);
    //have this run every cycle to always be targetting the highest worth server
    let ServerList = sort(ns, multiscan(ns, "home"));
    const Target = ServerList[0];
    ns.write("/home/hackLog.txt", "Target: " + Target + "\n");
    //get all pservs to always have up to date info on RAM capacity/num of servers if early game 
    let HostServs = ["home"];
    ns.getPurchasedServers().forEach(serv => {
      // writes needed scripts to host server
      ns.scp("ScriptedGrow.js", serv);
      ns.scp("ScriptedHack.js", serv);
      ns.scp("ScriptedWeaken.js", serv);
      HostServs.push(serv);
    })
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
      ns.write("/home/hackLog.txt", "Begin Growth Cycle - Loop Number: " + Loop.toString() + "\n" + "\n");
      ns.write("/home/hackLog.txt", "Target Maximum Cash Avaliable: " + ns.getServerMaxMoney(Target) + "\n");
      ns.write("/home/hackLog.txt", "Target Current Cash Avaliable: " + ns.getServerMoneyAvailable(Target) + "\n");
      ns.write("/home/hackLog.txt", "Target Minimum Security Level: " + ns.getServerMinSecurityLevel(Target) + "\n");
      ns.write("/home/hackLog.txt", "Target Current Security Level: " + ns.getServerSecurityLevel(Target) + "\n" + "\n");
      ns.print("Loop " + Loop.toString() + " includes a grow cycle.\n");

      const groThreads = Math.ceil((ns.growthAnalyze(Target, (ns.getServerMaxMoney(Target) / ns.getServerMoneyAvailable(Target)))) / 64);
      let secIncreaseG = Math.ceil(ns.growthAnalyzeSecurity(groThreads, Target) / 64);
      let weakenThreadsG = 1;
      while (Math.ceil(ns.weakenAnalyze(weakenThreadsG) < secIncreaseG * 1.1)) {
        weakenThreadsG += 3;
        await ns.sleep(1)
      }
      const growTime = ns.getGrowTime(Target);
      const weakTime = ns.getWeakenTime(Target);
      const growExecTime = weakTime - growTime + 20;

      const requiredRAM = (
        ns.getScriptRam("ScriptedGrow.js") * groThreads +
        ns.getScriptRam("ScriptedWeaken.js") * weakenThreadsG);

      //execution loop - threads were divided into 64ths to fit across servers as needed
      let iterations = 64
      let serv = 0
      while (iterations > 0) {
        //if on home, consider reserved RAM
        if (HostServs[serv] == "home") {
          while (ns.getServerMaxRam(HostServs[serv]) - ns.getServerUsedRam(HostServs[serv]) - reservedRAM > requiredRAM) {
            await ns.exec("ScriptedGrow.js", HostServs[serv], groThreads, groThreads, growExecTime, Target);
            await ns.exec("ScriptedWeaken.js", HostServs[serv], weakenThreadsG, weakenThreadsG, Target);
            iterations--;
            await ns.sleep(20)
          }
          serv++
        }
        //if not on home, disregard reserved RAM
        else {
          while (ns.getServerMaxRam(HostServs[serv]) - ns.getServerUsedRam(HostServs[serv]) > requiredRAM) {
            await ns.exec("ScriptedGrow.js", HostServs[serv], groThreads, groThreads, growExecTime, Target);
            await ns.exec("ScriptedWeaken.js", HostServs[serv], weakenThreadsG, weakenThreadsG, Target);
            iterations--;
            await ns.sleep(20)
          }
          serv++
        }
      }
      ns.print("growth cycle executed. Time to complete: " + ns.tFormat(Cycle))
      await ns.sleep(Cycle);
      ns.print("growth cycle complete")
    }

    if (ns.getServerSecurityLevel > ns.getServerMinSecurityLevel) {
      ns.write("/home/hackLog.txt", "Begin Weaken Cycle - Loop Number: " + Loop.toString() + "\n" + "\n");
      ns.write("/home/hackLog.txt", "Target Minimum Security Level: " + ns.getServerMinSecurityLevel(Target) + "\n");
      ns.write("/home/hackLog.txt", "Target Current Security Level: " + ns.getServerSecurityLevel(Target) + "\n" + "\n");
      ns.print("Loop " + Loop.toString() + " includes a weaken cycle.\n");

      //Thread Math to lower Sec to min
      let secDif = Math.ceil((ns.getServerMinSecurityLevel - ns.getServerSecurityLevel) / 64);
      let weakenThreads = 1;
      while (Math.ceil(ns.weakenAnalyze(weakenThreads) < secDif * 1.1)) {
        weakenThreads += 3;
        await ns.sleep(1)
      }
      const requiredRAM = (ns.getScriptRam("ScriptedWeaken.js") * weakenThreads);
      //execution loop - threads were divided into 64ths to fit across servers as needed
      let iterations = 64
      let serv = 0
      while (iterations > 0) {
        //if on home, consider reserved RAM
        if (HostServs[serv] == "home") {
          while (ns.getServerMaxRam(HostServs[serv]) - ns.getServerUsedRam(HostServs[serv]) - reservedRAM > requiredRAM) {
            await ns.exec("ScriptedWeaken.js", HostServs[serv], weakenThreads, weakenThreads, Target);
            iterations--;
            await ns.sleep(20)
          }
          serv++
        }
        //if not on home, disregard reserved RAM
        else {
          while (ns.getServerMaxRam(HostServs[serv]) - ns.getServerUsedRam(HostServs[serv]) > requiredRAM) {
            await ns.exec("ScriptedWeaken.js", HostServs[serv], weakenThreads, weakenThreads, Target);
            iterations--;
            await ns.sleep(20)
          }
          serv++
        }
      }
      ns.print("weaken cycle executed. Time to complete: " + ns.tFormat(Cycle))
      await ns.sleep(Cycle);
      ns.print("weaken cycle complete")
    }


    //threads math
    let groThreads = Math.ceil(ns.growthAnalyze(Target, 2));
    let hackThreads = Math.ceil(ns.hackAnalyzeThreads(Target, ns.getServerMoneyAvailable(Target) / 2));
    let secIncreaseH = Math.ceil(ns.hackAnalyzeSecurity(hackThreads, Target));
    let secIncreaseG = Math.ceil(ns.growthAnalyzeSecurity(groThreads, Target));
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
    const requiredRAM = (ns.getScriptRam("ScriptedHack.js") * hackThreads +
      ns.getScriptRam("ScriptedWeaken.js") * weakenThreadsH +
      ns.getScriptRam("ScriptedGrow.js") * groThreads +
      ns.getScriptRam("ScriptedWeaken.js") * weakenThreadsG);

    //error detection
    if (hackThreads < 1 || weakenThreadsG < 1 || weakenThreadsH < 1 || groThreads < 1) {
      ns.toast("Error in Hack Manager!", "error", 5000);
      ns.print("Uh oh! something broke!");
      ns.print("hack threads: " + hackThreads);
      ns.print("WeakenH threads: " + weakenThreadsH);
      ns.print("WeakenG threads: " + weakenThreadsG);
      ns.print("grow threads: " + groThreads);
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
    ns.write("/home/hackLog.txt", "Begin Regular Cycle - Loop Number: " + Loop.toString() + "\n");
    ns.write("/home/hackLog.txt", "Target Maximum Cash Avaliable: " + ns.getServerMaxMoney(Target) + "\n");
    ns.write("/home/hackLog.txt", "Target Current Cash Avaliable: " + ns.getServerMoneyAvailable(Target) + "\n");
    ns.write("/home/hackLog.txt", "Target Minimum Security Level: " + ns.getServerMinSecurityLevel(Target) + "\n");
    ns.write("/home/hackLog.txt", "Target Current Security Level: " + ns.getServerSecurityLevel(Target) + "\n");
    ns.write("/home/hackLog.txt", "\n");


    //execution loop
    for (let i = 0; i < HostServs.length; i++) {
      //if on home, consider reserved RAM
      if (HostServs[i] == "home") {
        while (ns.getServerMaxRam(HostServs[i]) - ns.getServerUsedRam(HostServs[i]) - reservedRAM > requiredRAM) {
          ns.exec("ScriptedHack.js", "home", hackThreads, hackThreads, hackExecTime, Target);
          ns.exec("ScriptedWeaken.js", "home", weakenThreadsH, weakenThreadsH, Target);
          ns.exec("ScriptedGrow.js", "home", groThreads, groThreads, growExecTime, Target);
          ns.exec("ScriptedWeaken.js", "home", weakenThreadsG, weakenThreadsG, Target);
        }
      }
      //if not on home, disregard reserved RAM
      else {
        while (ns.getServerMaxRam(HostServs[i]) - ns.getServerUsedRam(HostServs[i]) > requiredRAM) {
          ns.exec("ScriptedHack.js", HostServs[i], hackThreads, hackThreads, hackExecTime, Target);
          ns.exec("ScriptedWeaken.js", HostServs[i], weakenThreadsH, weakenThreadsH, Target);
          ns.exec("ScriptedGrow.js", HostServs[i], groThreads, groThreads, growExecTime, Target);
          ns.exec("ScriptedWeaken.js", HostServs[i], weakenThreadsG, weakenThreadsG, Target);
        }
      }
      await ns.sleep(0)
    }
    //sleep for the amount of time it will take for all code to execute
    //before attempting to run more code
    ns.print("Hack cycle executed. Time to complete: " + ns.tFormat(Cycle))
    await ns.sleep(Cycle);
    Loop += 1;
  }
}
