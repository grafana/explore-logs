import { css } from "@emotion/css";
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from "@grafana/scenes";
import { Field, Input } from "@grafana/ui";
import React, { ChangeEvent } from "react";

interface LineFilterState extends SceneObjectState {
	search: string;
}

export class LineFilter extends SceneObjectBase<LineFilterState> {
	static Component = LineFilterRenderer;

	constructor(state?: Partial<LineFilterState>) {
		super({ search: '', ...state });
	}

	handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		this.setState({
			search: e.target.value,
		});
	}
}

function LineFilterRenderer({ model }: SceneComponentProps<LineFilter>) {
  const { search } = model.useState();

	console.log(search);

  return (
    <Field>
			<Input value={search} className={styles.input} onChange={model.handleChange} placeholder="Search" />
		</Field>
  );
}

const styles = {
	input: css({
		width: '100%',
	})
}
