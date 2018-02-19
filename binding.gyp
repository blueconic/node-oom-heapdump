{
	"targets" : [{
		"target_name" : "node_oom_heapdump_native",
		"sources" : [ "lib/node_oom_heapdump_native.cc" ],
		"include_dirs": [
			'<!(node -e "require(\'nan\')")'
		],
		"win_delay_load_hook" : "false"
	}]
}