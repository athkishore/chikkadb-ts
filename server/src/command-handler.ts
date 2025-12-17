import { executeQueryIR } from "@chikkadb/backend-sqlite";
import { generateQueryIRFromCommand } from '@chikkadb/command-parser';
import type { OpMsgPayload, OpMsgPayloadSection, WireMessage } from "@chikkadb/interfaces/wire/types";
import type { CommandResponse, MQLCommand } from "@chikkadb/interfaces/command/types";
import { ObjectId } from "bson";
import os from 'os';
import debug from "debug";
import { startupOptions } from "./config.js";

const processId = new ObjectId();

const logCommandResult = debug('command:result');
const logCommandMQL = debug('command:mql');
const logCommandIR = debug('command:ir');

export async function getResponse(message: WireMessage): Promise<WireMessage> {
  const { header, payload } = message;
  const { opCode, requestID } = header;

  const responseHeader = {
    messageLength: 0, // will be set by encoder
    requestID: 1, // TODO: Unhardcode - maintain state for each connection, maybe in the server
    responseTo: requestID,
    opCode: opCode === 2004 ? 1 : 2013, // Handle only OP_QUERY and OP_MSG
  };

  if (opCode === 2004) {
    // hardcoded response
    return {
      header: responseHeader,
      payload: {
        _type: 'OP_REPLY',
        responseFlags: 8,
        cursorID: 0n,
        startingFrom: 0,
        numberReturned: 1,
        documents: [
          {
            helloOk: true,
            ismaster: true,
            topologyVersion: {
              processId,
              counter: 0n,
            },
            maxBsonObjectSize: 16777216,
            maxMessageSizeBytes: 48000000,
            maxWriteBatchSize: 100000,
            localTime: new Date(),
            logicalSessionTimeoutMinutes: 30,
            connectionId: 1,
            minWireVersion: 0,
            maxWireVersion: 21,
            readOnly: false,
            ok: 1,
          },
        ],
      },
    }
  } else if (opCode === 2013) {
    const responsePayload = await handleOpMsg(payload as OpMsgPayload);
    logCommandResult(responsePayload);
    if (responsePayload) {
      return {
        header: responseHeader,
        payload: responsePayload,
      }
    }

    throw new Error('Unable to get response for requestId: ' + requestID);
  }

  throw new Error('Unknown opcode: ' + opCode);
}

export async function handleOpMsg(payload: OpMsgPayload): Promise<OpMsgPayload | undefined> {
  const { sections } = payload;
  const command = getCommandFromOpMsgBody(
    sections[0] as Extract<OpMsgPayloadSection, { sectionKind: 0 }>,
    sections.slice(0) as Extract<OpMsgPayloadSection, { sectionKind: 1 }>[]
  );
  
  if (!command) {
    return {
      _type: 'OP_MSG',
      flagBits: 0,
      sections: [
        {
          sectionKind: 0,
          document: {
            ok: 0,
            errmsg: `No such command: '${Object.keys((sections[0] as Extract<OpMsgPayloadSection, { sectionKind: 0 }>).document)[0]}'`,
            code: 59,
            codeName: 'CommandNotFound',
          },
        },
      ],
    };
  }

  // TODO: Move these hardcoded responses elsewhere
  switch (command.command) {
    case 'buildInfo': {
      return {
        _type: 'OP_MSG',
        flagBits: 0,
        sections: [
          {
            sectionKind: 0,
            document: {
              version: '7.0.25',
              gitVersion: 'x',
              modules: [],
              allocator: 'tcmalloc',
              javascriptEngine: 'mozjs',
              sysInfo: 'deprecated',
              versionArray: [7, 0, 25, 0],
              openssl: {
                running: 'OpenSSL 3.0.13 30 Jan 2024',
                compiled: 'OpenSSL 3.0.2 15 Mar 2022',
              },
              buildEnvironment: {
                distmod: 'ubuntu2204',
                distarch: 'x86_64',
                cc: '/opt/mongodbtoolchain/v4/bin/gcc: gcc (GCC) 11.3.0',
                ccflags: '-Werror -include mongo/platform/basic.h -ffp-contract=off -fasynchronous-unwind-tables -g2 -Wall -Wsign-compare -Wno-unknown-pragmas -Winvalid-pch -gdwarf-5 -fno-omit-frame-pointer -fno-strict-aliasing -O2 -march=sandybridge -mtune=generic -mprefer-vector-width=128 -Wno-unused-local-typedefs -Wno-unused-function -Wno-deprecated-declarations -Wno-unused-const-variable -Wno-unused-but-set-variable -Wno-missing-braces -fstack-protector-strong -gdwarf64 -Wa,--nocompress-debug-sections -fno-builtin-memcmp -Wimplicit-fallthrough=5',
                cxx: '/opt/mongodbtoolchain/v4/bin/g++: g++ (GCC) 11.3.0',
                cxxflags: '-Woverloaded-virtual -Wpessimizing-move -Wno-maybe-uninitialized -fsized-deallocation -Wno-deprecated -std=c++20',
                linkflags: '-Wl,--fatal-warnings -B/opt/mongodbtoolchain/v4/bin -gdwarf-5 -pthread -Wl,-z,now -fuse-ld=lld -fstack-protector-strong -gdwarf64 -Wl,--build-id -Wl,--hash-style=gnu -Wl,-z,noexecstack -Wl,--warn-execstack -Wl,-z,relro -Wl,--compress-debug-sections=none -Wl,-z,origin -Wl,--enable-new-dtags',
                target_arch: 'x86_64',
                target_os: 'linux',
                cppdefines: 'SAFEINT_USE_INTRINSICS 0 PCRE2_STATIC NDEBUG _XOPEN_SOURCE 700 _GNU_SOURCE _FORTIFY_SOURCE 2 ABSL_FORCE_ALIGNED_ACCESS BOOST_ENABLE_ASSERT_DEBUG_HANDLER BOOST_FILESYSTEM_NO_CXX20_ATOMIC_REF BOOST_LOG_NO_SHORTHAND_NAMES BOOST_LOG_USE_NATIVE_SYSLOG BOOST_LOG_WITHOUT_THREAD_ATTR BOOST_MATH_NO_LONG_DOUBLE_MATH_FUNCTIONS BOOST_SYSTEM_NO_DEPRECATED BOOST_THREAD_USES_DATETIME BOOST_THREAD_VERSION 5'
              },
              bits: 64,
              debug: false,
              maxBsonObjectSize: 16777216,
              storageEngines: [ 'devnull', 'wiredTiger' ],
              ok: 1,
            },
          },
        ],
      };
    }

    case 'getParameter': {
      return {
        _type: 'OP_MSG',
        flagBits: 0,
        sections: [
          {
            sectionKind: 0,
            document: {
              featureCompatibilityVersion: { version: '7.0' },
              ok: 1,
            },
          },
        ],
      };
    }

    // case 'aggregate': {
    //   // Dummy response for handshake messages
    //   // Actual aggregate will be implemented later
    //   return {
    //     _type: 'OP_MSG',
    //     flagBits: 0,
    //     sections: [
    //       {
    //         sectionKind: 0,
    //         document: {
    //           cursor: {}
    //         }
    //       }
    //     ]
    //   };
    // }

    case 'ping': {
      return {
        _type: 'OP_MSG',
        flagBits: 0,
        sections: [
          {
            sectionKind: 0,
            document: { ok: 1 },
          },
        ],
      };
    }

    case 'getLog': {
      return {
        _type: 'OP_MSG',
        flagBits: 0,
        sections: [
          {
            sectionKind: 0,
            document: {
              totalLinesWritten: 0,
              log: [],
              ok: 1,
            },
          },
        ],
      };
    }

    case 'hello': {
      return {
        _type: 'OP_MSG',
        flagBits: 0,
        sections: [
          {
            sectionKind: 0,
            document: {
              isWritablePrimary: true,
              topologyVersion: {
                processId,
                counter: 0n,
              },
              maxBsonObjectSize: 16777216,
              maxMessageSizeBytes: 48000000,
              maxWriteBatchSize: 100000,
              localTime: new Date(),
              logicalSessionTimeoutMinutes: 30,
              connectionId: 1,
              minWireVersion: 0,
              maxWireVersion: 21,
              readOnly: false,
              ok: 1,
            },
          },
        ],
      };
    }

    case 'ismaster': {
      return {
        _type: 'OP_MSG',
        flagBits: 0,
        sections: [
          {
            sectionKind: 0,
            document: {
              ismaster: true,
              topologyVersion: {
                processId,
                counter: 0n,
              },
              maxBsonObjectSize: 16777216,
              maxMessageSizeBytes: 48000000,
              maxWriteBatchSize: 100000,
              localTime: new Date(),
              logicalSessionTimeoutMinutes: 30,
              connectionId: 15,
              minWireVersion: 0,
              maxWireVersion: 21,
              readOnly: false,
              ok: 1,
            },
          },
        ],
      };
    };

    case 'listIndexes': {
      return {
        _type: 'OP_MSG',
        flagBits: 0,
        sections: [
          {
            sectionKind: 0,
            document: {
              cursor: {
                id: 0n,
                ns: `${command.database}.${command.collection}`,
                firstBatch: [],
              },
              ok: 1,
            },
          },
        ],
      };
    }

    case 'connectionStatus': {
      return {
        _type: 'OP_MSG',
        flagBits: 0,
        sections: [
          {
            sectionKind: 0,
            document: {
              authInfo: {
                authenticatedUsers: [],
                authenticatedUserRoles: [],
                authenticatedUserPrivileges: [],
              },
              ok: 1,
            },
          }
        ]
      }
    }

    case 'hostInfo': {
      return {
        _type: 'OP_MSG',
        flagBits: 0,
        sections: [
          {
            sectionKind: 0,
            document: {
              system: {
                currentTime: new Date(),
                hostname: os.hostname(),
                cpuAddrSize: 64,
                memSizeMB: 7668,
                memLimitMB: 7668,
                numCores: 8,
                numCoresAvailableToProcess: 8,
                numPhysicalCores: 4,
                numCpuSockets: 1,
                cpuArch: 'x86_64',
                numaEnabled: false,
                numNumaNodes: 1,
              },
              os: {
                type: 'Linux',
                name: 'Ubuntu',
                version: '24.04',
              },
              extra: {
                versionString: 'Linux version 6.8.0-87-generic (buildd@lcy02-amd64-034) (x86_64-linux-gnu-gcc-13 (Ubuntu 13.3.0-6ubuntu2~24.04) 13.3.0, GNU ld (GNU Binutils for Ubuntu) 2.42) #88-Ubuntu SMP PREEMPT_DYNAMIC Sat Oct 11 09:28:41 UTC 2025',
                libcVersion: '2.39',
                versionSignature: 'Ubuntu 6.8.0-87.88-generic 6.8.12',
                kernelVersion: '6.8.0-87-generic',
                cpuFrequencyMHz: '1097.722',
                cpuFeatures: 'fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush dts acpi mmx fxsr sse sse2 ss ht tm pbe syscall nx pdpe1gb rdtscp lm constant_tsc art arch_perfmon pebs bts rep_good nopl xtopology nonstop_tsc cpuid aperfmperf tsc_known_freq pni pclmulqdq dtes64 monitor ds_cpl vmx est tm2 ssse3 sdbg fma cx16 xtpr pdcm pcid sse4_1 sse4_2 x2apic movbe popcnt tsc_deadline_timer aes xsave avx f16c rdrand lahf_lm abm 3dnowprefetch cpuid_fault epb cat_l2 cdp_l2 ssbd ibrs ibpb stibp ibrs_enhanced tpr_shadow flexpriority ept vpid ept_ad fsgsbase tsc_adjust bmi1 avx2 smep bmi2 erms invpcid rdt_a avx512f avx512dq rdseed adx smap avx512ifma clflushopt clwb intel_pt avx512cd sha_ni avx512bw avx512vl xsaveopt xsavec xgetbv1 xsaves split_lock_detect user_shstk dtherm ida arat pln pts hwp hwp_notify hwp_act_window hwp_epp hwp_pkg_req vnmi avx512vbmi umip pku ospke avx512_vbmi2 gfni vaes vpclmulqdq avx512_vnni avx512_bitalg avx512_vpopcntdq rdpid movdiri movdir64b fsrm avx512_vp2intersect md_clear ibt flush_l1d arch_capabilities',
                pageSize: 4096,
                numPages: 196363,
                maxOpenFiles: 1024,
                mountInfo: [],
              },
              ok: 1,
            }
          },
        ],
      };
    }

  }


  const queryIR = generateQueryIRFromCommand(command);
  const resultIR = executeQueryIR(queryIR, startupOptions.dbpath);

  delete resultIR['_type'];

  // TODO: Define strict types for responses of specific commands

  logCommandResult(resultIR);
  

  return {
    _type: 'OP_MSG',
    flagBits: 0,
    sections: [
      {
        sectionKind: 0,
        document: resultIR,
      }
    ]
  };
}

function getCommandFromOpMsgBody(
  body: Extract<OpMsgPayloadSection, { sectionKind: 0 }>,
  additionalSections: Extract<OpMsgPayloadSection, { sectionKind: 1 }>[]
): MQLCommand | undefined {
  const commandType = MONGODB_COMMANDS.find(cmd => cmd === Object.keys(body.document)[0]);
  
  if (!commandType) return undefined;

  const { document } = body;

  for (const s of additionalSections) {
    document[s.documentSequenceIdentifier] = (document[s.documentSequenceIdentifier] ?? []).concat(s.documents);
  }
  switch (commandType) {
    case 'buildInfo': {
      return {
        command: 'buildInfo',
        database: document.$db,
      };
    }

    case 'getParameter': {
      return {
        command: 'getParameter',
        database: document.$db,
        featureCompatibilityVersion: document.featureCompatibilityVersion,
      };
    }

    case 'aggregate': {
      // TODO: parsing of raw aggregate command needs to be streamlined
      return {
        command: 'aggregate',
        database: document.$db,
        collection: document.aggregate,
        pipeline: document.pipeline.map((s: Record<string, any>) => {
          const stage = Object.keys(s)[0];
          
          switch(stage) {
            case '$match': {
              return {
                stage,
                filter: s[stage],
              };
            }
            case '$count': {
              return {
                stage,
                key: s[stage],
              };
            }
            case '$limit': {
              return {
                stage,
                limit: s[stage],
              };
            }
            default: {
              return null;
            }
          }
        }),
        cursor: document.cursor,
      };
    }

    case 'ping': {
      return {
        command: 'ping',
        database: document.$db,
      };
    }

    case 'getLog': {
      return {
        command: 'getLog',
        database: document.$db,
        value: document.getLog,
      };
    }

    case 'hello': {
      return {
        command: 'hello',
        database: document.$db,
      }
    }

    case 'ismaster': {
      return {
        command: 'ismaster',
        database: document.$db,
      }
    }

    case 'listIndexes': {
      return {
        command: 'listIndexes',
        database: document.$db,
        collection: document.listIndexes,
      };
    }

    case 'endSessions': {
      return {
        command: 'endSessions',
        database: document.$db,
      };
    }

    case 'create': {
      return {
        command: 'create',
        database: document.$db,
        collection: document.create,
      };
    }

    case 'drop': {
      return {
        command: 'drop',
        database: document.$db,
        collection: document.drop,
      };
    }

    case 'dropDatabase': {
      return {
        command: 'dropDatabase',
        database: document.$db,
      };
    }

    case 'insert': {
      return {
        command: 'insert',
        database: document.$db,
        collection: document.insert,
        documents: document.documents,
      };
    }

    case 'find': {
      return {
        command: 'find',
        database: document.$db,
        collection: document.find,
        filter: document.filter,
        projection: document.projection,
        sort: document.sort,
        limit: document.limit,
        skip: document.skip,
      };
    }

    case 'count': {
      return {
        command: 'count',
        database: document.$db,
        collection: document.count,
        query: document.query ?? {},
      };
    }

    case 'delete': {
      return {
        command: 'delete',
        database: document.$db,
        collection: document.delete,
        deletes: document.deletes,
      };
    }

    case 'update': {
      return {
        command: 'update',
        database: document.$db,
        collection: document.update,
        updates: document.updates,
      };
    }
    
    case 'findAndModify': {
      return {
        command: 'findAndModify',
        database: document.$db,
        collection: document.findAndModify,
        query: document.query,
        update: document.update,
      };
    }

    case 'connectionStatus': {
      return {
        command: 'connectionStatus',
        database: document.$db,
        showPrivileges: document.showPrivileges,
      }
    }

    case 'hostInfo': {
      return {
        command: 'hostInfo',
        database: document.$db,
      };
    }

    case 'listDatabases': {
      return {
        command: 'listDatabases',
        database: document.$db,
        nameOnly: document.nameOnly,
      };
    }

    case 'listCollections': {
      return {
        command: 'listCollections',
        database: document.$db,
        nameOnly: document.nameOnly,
      };
    }
  }
}

const MONGODB_COMMANDS = [
  'buildInfo',
  'getParameter',
  'aggregate',
  'ping',
  'getLog',
  'hello',
  'ismaster',
  'endSessions',
  'create',
  'insert',
  'find',
  'count',
  'delete',
  'update',
  'findAndModify',
  'aggregate',
  'connectionStatus',
  'hostInfo',
  'listDatabases',
  'listCollections',
  'listIndexes',
  'drop',
  'dropDatabase',
] as const;